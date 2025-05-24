// database.js
const mongoose = require('mongoose');
require('dotenv').config(); // Load .env variables

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/ticketSystem';

async function connectDB() {
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

const ticketSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  ticketName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'Created' },
  description: { type: String },
  transactionHash: { type: String },
  order: {
    type: {
      service: String,
      budget: String,
      deadline: String,
      answers: mongoose.Schema.Types.Mixed
    },
    default: null
  }
});
const Ticket = mongoose.model('Ticket', ticketSchema);

const freelancerApplicationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  service: { type: String, required: true },
  answers: [String],
  status: { type: String, default: 'Pending' },
  submittedAt: { type: Date, default: Date.now }
});
const FreelancerApplication = mongoose.model('FreelancerApplication', freelancerApplicationSchema);

const reportSchema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true },
  reporterId: { type: String, required: true },
  reporterUsername: { type: String, required: true },
  reportedUserIds: { type: [String], default: [] },
  orderIdOrTicketId: { type: String, default: null },
  description: { type: String, required: true },
  proofLinks: { type: [String], default: [] },
  expectedResolution: { type: String, default: 'Not specified' },
  status: { type: String, default: 'Open' },
  createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', reportSchema);

const walletSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  address:   { type: String, required: true }
});
const Wallet = mongoose.model('Wallet', walletSchema);

// 💵 Payment Schema / Model
const paymentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  amount: { type: Number, required: true },
  proofText: { type: String },
  proofImage: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'released'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  approvedBy: { type: String },
  releasedBy: { type: String },
  releasedAt: { type: Date }
});
const Payment = mongoose.model('Payment', paymentSchema);

module.exports = {
  connectDB,
  Ticket,
  FreelancerApplication,
  Report,
  Wallet,
  Payment // ✅ included
};

