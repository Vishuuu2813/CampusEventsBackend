import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { College } from '../models/College';
import dns from 'node:dns';

const router = express.Router();

// Helps with DNS/SRV lookup issues on some networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

function normalizeUrl(input: string) {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function pickTopColors(hexes: string[]) {
  const counts = new Map<string, number>();
  for (const h of hexes) {
    const key = h.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);

  const isTooNeutral = (hex: string) => {
    const h = hex.replace('#', '').toLowerCase();
    return (
      h === 'ffffff' ||
      h === '000000' ||
      h === 'fefefe' ||
      h === '111111' ||
      h === '1a1a1a' ||
      h === 'eeeeee' ||
      h === 'f5f5f5'
    );
  };

  const filtered = sorted.filter((h) => !isTooNeutral(h));

  return {
    primary: filtered[0] || sorted[0] || '#6366f1',
    secondary: filtered[1] || sorted[1] || '#a855f7',
    palette: sorted.slice(0, 10),
  };
}

function extractFavicon(html: string, baseUrl: string) {
  const linkRegex =
    /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const match = linkRegex.exec(html);
  const href = match?.[1];
  if (!href) return '';
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function extractThemeColor(html: string) {
  const metaRegex = /<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)["'][^>]*>/i;
  const match = html.match(metaRegex);
  const color = match?.[1]?.trim();
  return color && color.startsWith('#') ? color : '';
}

// Public: analyze a website and suggest a theme (no auth required)
router.post('/analyze', async (req, res) => {
  try {
    const url = normalizeUrl(req.body?.url);
    if (!url) return res.status(400).json({ message: 'url is required' });

    const fetchHtml = async (targetUrl: string) => {
      const resp = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'user-agent': 'CampusPulseThemeAnalyzer/1.0',
          accept: 'text/html,application/xhtml+xml',
        },
      });
      return resp;
    };

    let resp: Response;
    try {
      resp = await fetchHtml(url);
    } catch (_err) {
      // Fallback: fetch via text proxy (handles some TLS/DNS/firewall cases)
      const proxyUrl = `https://r.jina.ai/${url}`;
      resp = await fetchHtml(proxyUrl);
    }

    if (!resp.ok) {
      return res.status(400).json({ message: `Unable to fetch website (status ${resp.status})` });
    }

    const html = await resp.text();

    const themeColor = extractThemeColor(html);
    const favicon = extractFavicon(html, url);

    // quick palette: find hex colors
    const hexMatches = html.match(/#[0-9a-fA-F]{6}\b/g) || [];
    const colors = pickTopColors(hexMatches);

    const primary = themeColor || colors.primary;
    const secondary = colors.secondary;

    res.json({
      url,
      suggested: {
        primaryColor: primary,
        secondaryColor: secondary,
        favicon,
        heroBanner: '',
        typography: '',
        headerStyle: 'glass',
        heroTitle: '',
        heroSubtitle: '',
      },
      palette: colors.palette,
      notes: [
        themeColor ? 'Primary color derived from meta theme-color.' : 'Primary color derived from dominant CSS hex colors.',
        favicon ? 'Favicon detected from link rel=icon.' : 'Favicon not detected.',
      ],
    });
  } catch (err: any) {
    console.error('Theme analyze error:', err);
    res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// College Admin: apply theme to my college
router.post('/apply', authMiddleware, async (req: AuthRequest, res) => {
  if (!req.user || req.user.role !== 'college_admin') {
    return res.status(403).json({ message: 'College Admin access required' });
  }

  try {
    const theme = req.body?.theme;
    if (!theme || typeof theme !== 'object') {
      return res.status(400).json({ message: 'theme is required' });
    }

    const updated = await College.findByIdAndUpdate(
      req.user.college,
      { theme: { ...theme, updatedAt: new Date() } },
      { new: true },
    );

    res.json(updated);
  } catch (err: any) {
    console.error('Theme apply error:', err);
    res.status(500).json({ message: err?.message || 'Server error' });
  }
});

export default router;

