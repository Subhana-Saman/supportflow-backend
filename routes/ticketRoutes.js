import express from 'express';
import { 
  createTicket, 
  getTickets, 
  getTicket, 
  updateTicket,
  assignTicket,
  resolveTicket
} from '../controllers/ticketController.js';
import { protect } from '../middleware/authMiddleware.js';
import { isCustomer, isAgent } from '../middleware/roleMiddleware.js';
import { validateTicket } from '../validators/ticketValidator.js';

const router = express.Router();

router.post('/', protect, isCustomer, validateTicket, createTicket);
router.get('/', protect, getTickets);
router.get('/:id', protect, getTicket);
router.patch('/:id', protect, isAgent, updateTicket);
router.patch('/:id/assign', protect, isAgent, assignTicket);
router.patch('/:id/resolve', protect, isAgent, resolveTicket);

export default router;