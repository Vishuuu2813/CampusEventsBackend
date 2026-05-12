import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    college?: string;
    department?: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { 
      id: string; 
      role: string;
      college?: string;
      department?: string;
      email?: string;
    };

    // Force super_admin role for the specific email if it's in the token
    if (decoded.email === 'vvishwas221@gmail.com') {
      decoded.role = 'super_admin';
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const adminRoles = ['super_admin', 'college_admin', 'dept_admin', 'admin'];
  if (!req.user || !adminRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied, administrative privileges required' });
  }
  next();
};
