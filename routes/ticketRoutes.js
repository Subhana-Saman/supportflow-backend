import express from 'express';
import { 
  createTicket, 
  getTickets, 
  getTicket, 
  updateTicket,
  assignTicket,
  resolveTicket,
  cancelTicket,
  reopenTicket,
  getTicketActivity
} from '../controllers/ticketController.js';
import { protect } from '../middleware/authMiddleware.js';
import { isCustomer, isAgent } from '../middleware/roleMiddleware.js';
import { validateTicket } from '../validators/ticketValidator.js';

const router = express.Router();

router.post('/', protect, isCustomer, validateTicket, createTicket);
router.get('/', protect, getTickets);
router.get('/:id', protect, getTicket);
router.get('/:id/activity', protect, getTicketActivity);
router.patch('/:id', protect, isAgent, updateTicket);
router.patch('/:id/assign', protect, isAgent, assignTicket);
router.patch('/:id/resolve', protect, isAgent, resolveTicket);
router.patch('/:id/cancel', protect, isCustomer, cancelTicket);
router.patch('/:id/reopen', protect, reopenTicket);

export default router;