import { body, validationResult } from 'express-validator';

export const validateMessage = [
  body('message')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 5000 }).withMessage('Message cannot exceed 5000 characters'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Need at least a message or an attachment — can't send a completely empty message
    const hasMessage = req.body.message && req.body.message.trim() !== '';
    const hasFile = !!req.file;
    if (!hasMessage && !hasFile) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    next();
  }
];