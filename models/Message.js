import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [1, 'Message cannot be empty'],
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  }
}, {
  timestamps: true
});

// Indexes
messageSchema.index({ ticket: 1 });
messageSchema.index({ createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;