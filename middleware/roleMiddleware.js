import User from '../models/User.js';

export const isCustomer = (req, res, next) => {
  if (req.user.role === 'customer') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Customer privileges required.'
    });
  }
};

export const isAgent = (req, res, next) => {
  if (req.user.role === 'agent' || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Agent privileges required.'
    });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};