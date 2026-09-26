const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());

const SECRET = process.env.JWT_SECRET || 'mashti-secret-2026';

/* =========================
   DATA
========================= */

let users = [
  {
    id: 1,
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    name: 'المدير',
    active: true
  },
  {
    id: 2,
    username: 'doctor1',
    password: bcrypt.hashSync('123456', 10),
    role: 'doctor',
    name: 'د. أحمد',
    active: true
  },
  {
    id: 3,
    username: 'secretary',
    password: bcrypt.hashSync('123456', 10),
    role: 'secretary',
    name: 'السكرتيرة',
    active: true
  }
];

let doctors = [
  {
    id: 1,
    name: 'د. أحمد - عام',
    consultation_rate: 30,
    examination_rate: 30,
    xray_rate: 30,
    booking_rate: 0
  },
  {
    id: 2,
    name: 'د. فاطمة - أسنان',
    consultation_rate: 30,
    examination_rate: 30,
    xray_rate: 30,
    booking_rate: 0
  }
];

let patients = [
  {
    id: 1,
    file_no: '1001',
    name: 'محمد سالم',
    phone: '22222222',
    cin: '123456',
    doctor_id: 1,
    service_type: 'استشارة',
    service_amount: 500,
    paid_amount: 300,
    payment_method: 'نقدًا',
    has_booking: false,
    booking_at: null,
    prescription: ''
  }
];

let queue = [];

let appointments = [];

let invoices = [
  {
    id: 1,
    invoice_no: 'INV-001',
    subtotal: 500,
    paid: 300,
    patient_name: 'محمد سالم',
    service_type: 'استشارة',
    payment_method: 'نقدًا',
    created_at: new Date().toISOString()
  }
];

let announcements = [
  {
    id: 1,
    title: 'دوام المصحة من 8 صباحا حتى 8 مساء'
  }
];

let specialties = [
  {
    id: 1,
    name: 'طب عام'
  },
  {
    id: 2,
    name: 'أسنان'
  }
];

let services = [
  {
    id: 1,
    name: 'تحليل دم',
    price: 0
  },
  {
    id: 2,
    name: 'أشعة',
    price: 0
  }
];

/* =========================
   HELPERS
========================= */

function nextId(list) {
  if (!list.length) {
    return 1;
  }

  return (
    Math.max(
      ...list.map(function (x) {
        return Number(x.id) || 0;
      })
    ) + 1
  );
}

function num(value, fallback) {
  const n = Number(value);

  if (Number.isFinite(n)) {
    return n;
  }

  return fallback === undefined ? 0 : fallback;
}

function safeDoctor(doctor) {
  if (!doctor) {
    return doctor;
  }

  return {
    id: doctor.id,
    name: doctor.name,
    consultation_rate: num(doctor.consultation_rate),
    examination_rate: num(doctor.examination_rate),
    xray_rate: num(doctor.xray_rate),
    booking_rate: num(doctor.booking_rate)
  };
}

function safeUser(user) {
  const result = Object.assign({}, user);
  delete result.password;
  return result;
}

/* =========================
   AUTH
========================= */

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      error: 'no token'
    });
  }

  try {
    const token = header.replace('Bearer ', '');

    req.user = jwt.verify(token, SECRET);

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'invalid'
    });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'غير مصرح'
    });
  }

  next();
}

/* =========================
   ROOT
========================= */

app.get('/', function (req