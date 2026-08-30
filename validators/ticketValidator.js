import { body, validationResult } from 'express-validator';

export const validateTicket = [
  body('subject')
    .trim()
    .isLength({ min: 3 }).withMessage('Subject must be at least 3 characters')
    .isLength({ max: 100 }).withMessage('Subject cannot exceed 100 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters')
    .isLength({ max: 5000 }).withMessage('Description cannot exceed 5000 characters'),
  
  body('category')
    .optional()
    .isIn(['Billing', 'Technical', 'Account', 'Order', 'Refund', 'Other'])
    .withMessage('Invalid category'),
  
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High'])
    .withMessage('Invalid priority'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];