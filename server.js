const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());

const SECRET = process.env.JWT_SECRET || 'mashti-secret-2026';

/* =========================
   بيانات النظام
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
  { id: 1, name: 'طب عام' },
  { id: 2, name: 'أسنان' }
];

let services = [
  { id: 1, name: 'تحليل دم', price: 0 },
  { id: 2, name: 'أشعة', price: 0 }
];

/* =========================
   أدوات مساعدة
========================= */

function nextId(list) {
  if (!list.length) return 1;
  return Math.max(...list.map(x => Number(x.id) || 0)) + 1;
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function doctorForResponse(d) {
  if (!d) return d;

  return {
    ...d,
    consultation_rate: number(d.consultation_rate),
    examination_rate: number(d.examination_rate),
    xray_rate: number(d.xray_rate),
    booking_rate: number(d.booking_rate)
  };
}

/* =========================
   المصادقة
========================= */

function auth(req, res, next) {
  const h = req.headers.authorization;

  if (!h) {
    return res.status(401).json({
      error: 'no token'
    });
  }

  try {
    const token = h.replace('Bearer ', '');
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({
      error: 'invalid'
    });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'غير مصرح'
    });
  }

  next();
}

/* =========================
   الرئيسية
========================= */

app.get('/', (req, res) => {
  res.send('Mashti Backend is Running!');
});

/* =========================
   تسجيل الدخول
========================= */

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  const u = users.find(x => x.username === username);

  if (!u) {
    return res.status(401).json({
      error: 'خطأ في الدخول'
    });
  }

  if (u.active === false) {
    return res.status(403).json({
      error: 'الحساب موقوف'
    });
  }

  if (!bcrypt.compareSync(password || '', u.password)) {
    return res.status(401).json({
      error: 'خطأ في الدخول'
    });
  }

  const token = jwt.sign(
    {
      id: u.id,
      role: u.role
    },
    SECRET
  );

  const safeUser = { ...u };
  delete safeUser.password;

  res.json({
    token,
    user: safeUser
  });
});

/* =========================
   تسجيل المريض
========================= */

app.post('/api/auth/register-patient', (req, res) => {
  const {
    file_no,
    phone,
    username,
    password
  } = req.body;

  const pat = patients.find(
    p => p.file_no === file_no && p.phone === phone
  );

  if (!pat) {
    return res.status(404).json({
      error: 'رقم الملف أو الهاتف غير موجود'
    });
  }

  if (users.find(u => u.username === username)) {
    return res.status(400).json({
      error: 'اسم المستخدم موجود'
    });
  }

  const nu = {
    id: nextId(users),
    username,
    password: bcrypt.hashSync(password, 10),
    role: 'patient',
    patient_id: pat.id,
    name: pat.name,
    active: true
  };

  users.push(nu);

  const token = jwt.sign(
    {
      id: nu.id,
      role: nu.role
    },
    SECRET
  );

  const safeUser = { ...nu };
  delete safeUser.password;

  res.json({
    token,
    user: safeUser
  });
});

/* =========================
   الأطباء
========================= */

app.get('/api/doctors', auth, (req, res) => {
  res.json(doctors.map(doctorForResponse));
});

app.post('/api/doctors', auth, (req, res) => {
  const {
    name,
    consultation_rate,
    examination_rate,
    xray_rate,
    booking_rate
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({
      error: 'اسم الطبيب مطلوب'
    });
  }

  const doctor = {
    id: nextId(doctors),
    name: String(name).trim(),
    consultation_rate: number(consultation_rate),
    examination_rate: number(examination_rate),
    xray_rate: number(xray_rate),
    booking_rate: number(booking_rate)
  };

  doctors.push(doctor);

  res.json(doctorForResponse(doctor));
});

app.patch('/api/doctors/:id', auth, (req, res) => {
  const doctor = doctors.find(
    x => String(x.id) === String(req.params.id)
  );

  if (!doctor) {
    return res.status(404).json({
      error: 'الطبيب غير موجود'
    });
  }

  if (req.body.name !== undefined) {
    doctor.name = String(req.body.name).trim();
  }

  if (req.body.consultation_rate !== undefined) {
    doctor.consultation_rate = number(req.body.consultation_rate);
  }

  if (req.body.examination_rate !== undefined) {
    doctor.examination_rate = number(req.body.examination_rate);
  }

  if (req.body.xray_rate !== undefined) {
    doctor.xray_rate = number(req.body.xray_rate);
  }

  if (req.body.booking_rate !== undefined) {
    doctor.booking_rate = number(req.body.booking_rate);
  }

  res.json(doctorForResponse(doctor));
});

/* =========================
   المرضى
========================= */

app.get('/api/reception/search', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();

  res.json(
    patients.filter(
      p =>
        String(p.file_no || '').toLowerCase().includes(q) ||
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.phone || '').toLowerCase().includes(q)
    )
  );
});

app.get('/api/patients', auth, (req, res) => {
  res.json(patients);
});

app.get('/api/patients/:id', auth, (req, res) => {
  const patient = patients.find(
    p => String(p.id) === String(req.params.id)
  );

  if (!patient) {
    return res.status(404).json({
      error: 'المريض غير موجود'
    });
  }

  res.json({
    patient,
    visits: []
  });
});

app.post('/api/patients', auth, (req, res) => {
  const {
    file_no,
    name,
    phone,
    doctor_id,
    service_type,
    service_amount,
    paid_amount,
    payment_method,
    has_booking,
    booking_at,
    prescription
  } = req.body;

  if (!file_no || !name) {
    return res.status(400).json({
      error: 'رقم الملف واسم المريض مطلوبان'
    });
  }

  const total = number(service_amount);
  const paid = number(paid_amount);

  if (paid > total) {
    return res.status(400).json({
      error: 'المبلغ المدفوع أكبر من المطلوب'
    });
  }

  const patient = {
    id: nextId(patients),
    file_no: String(file_no).trim(),
    name: String(name).trim(),
    phone: String(phone || '').trim(),
    doctor_id: doctor_id || null,
    service_type: service_type || 'استشارة',
    service_amount: total,
    paid_amount: paid,
    payment_method: payment_method || 'نقدًا',
    has_booking: has_booking === true,
    booking_at: booking_at || null,
    prescription: String(prescription || ''),
    created_at: new Date().toISOString()
  };

  patients.push(patient);

  invoices.push({
    id: nextId(invoices),
    invoice_no: 'INV-' + Date.now(),
    subtotal: total,
    paid: paid,
    patient_name: patient.name,
    service_type: patient.service_type,
    payment_method: patient.payment_method,
    created_at: patient.created_at
  });

  res.json(patient);
});

/* =========================
   المستخدمون والصلاحيات
========================= */

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  res.json(
    users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      name: u.name,
      active: u.active !== false
    }))
  );
});

app.post('/api/admin/users', auth, adminOnly, (req, res) => {
  const {
    username,
    password,
    role,
    name
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'اسم المستخدم وكلمة المرور مطلوبان'
    });
  }

  if (users.some(u => u.username === username)) {
    return res.status(400).json({
      error: 'اسم المستخدم موجود'
    });
  }

  const user = {
    id: nextId(users),
    username: String(username).trim(),
    password: bcrypt.hashSync(password, 10),
    role: role || 'secretary',
    name: name || username,
    active: true
  };

  users.push(user);

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    active: true
  });
});

app.patch('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const user = users.find(
    u => String(u.id) === String(req.params.id)
  );

  if (!user) {
    return res.status(404).json({
      error: '