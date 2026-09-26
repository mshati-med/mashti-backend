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
    consultation_percent: 50,
    tests_percent: 50,
    xray_percent: 50,
    booking_percent: 50
  },
  {
    id: 2,
    name: 'د. فاطمة - أسنان',
    consultation_percent: 50,
    tests_percent: 50,
    xray_percent: 50,
    booking_percent: 50
  }
];

let patients = [
  {
    id: 1,
    file_no: '1001',
    name: 'محمد سالم',
    phone: '22222222',
    cin: '123456'
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
    created_at: new Date()
  }
];

let announcements = [
  {
    id: 1,
    title: 'دوام المصحة من 8 صباحا حتى 8 مساء',
    content: ''
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
   HELPERS
========================= */

function nextId(list) {
  if (!list.length) return 1;
  return Math.max.apply(
    null,
    list.map(function (x) {
      return Number(x.id) || 0;
    })
  ) + 1;
}

function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    patient_id: user.patient_id || null,
    active: user.active !== false
  };
}

function auth(req, res, next) {
  var header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      error: 'لا يوجد رمز دخول'
    });
  }

  try {
    var token = header.replace('Bearer ', '');
    var decoded = jwt.verify(token, SECRET);

    var user = users.find(function (u) {
      return u.id === decoded.id;
    });

    if (!user || user.active === false) {
      return res.status(401).json({
        error: 'الحساب غير فعال'
      });
    }

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({
      error: 'رمز الدخول غير صالح'
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
   BASIC
========================= */

app.get('/', function (req, res) {
  res.send('Mashti Backend is Running!');
});

/* =========================
   AUTH
========================= */

app.post('/api/auth/login', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;

  var user = users.find(function (u) {
    return u.username === username;
  });

  if (
    !user ||
    user.active === false ||
    !bcrypt.compareSync(password || '', user.password)
  ) {
    return res.status(401).json({
      error: 'خطأ في الدخول'
    });
  }

  var token = jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    SECRET,
    {
      expiresIn: '30d'
    }
  );

  res.json({
    token: token,
    user: safeUser(user)
  });
});

app.post('/api/auth/register-patient', function (req, res) {
  var file_no = req.body.file_no;
  var phone = req.body.phone;
  var username = req.body.username;
  var password = req.body.password;

  var patient = patients.find(function (p) {
    return p.file_no === file_no && p.phone === phone;
  });

  if (!patient) {
    return res.status(404).json({
      error: 'رقم الملف أو الهاتف غير موجود'
    });
  }

  var exists = users.find(function (u) {
    return u.username === username;
  });

  if (exists) {
    return res.status(400).json({
      error: 'اسم المستخدم موجود'
    });
  }

  var newUser = {
    id: nextId(users),
    username: username,
    password: bcrypt.hashSync(password, 10),
    role: 'patient',
    patient_id: patient.id,
    name: patient.name,
    active: true
  };

  users.push(newUser);

  var token = jwt.sign(
    {
      id: newUser.id,
      role: newUser.role
    },
    SECRET,
    {
      expiresIn: '30d'
    }
  );

  res.json({
    token: token,
    user: safeUser(newUser)
  });
});/* =========================
   DOCTORS
========================= */

app.get('/api/doctors', auth, function (req, res) {
  res.json(doctors);
});

app.post('/api/doctors', auth, adminOnly, function (req, res) {
  var doctor = {
    id: nextId(doctors),
    name: req.body.name || 'طبيب جديد',
    consultation_percent: Number(req.body.consultation_percent) || 0,
    tests_percent: Number(req.body.tests_percent) || 0,
    xray_percent: Number(req.body.xray_percent) || 0,
    booking_percent: Number(req.body.booking_percent) || 0
  };

  doctors.push(doctor);

  res.json(doctor);
});

app.patch('/api/doctors/:id', auth, adminOnly, function (req, res) {
  var doctor = doctors.find(function (d) {
    return d.id == req.params.id;
  });

  if (!doctor) {
    return res.status(404).json({
      error: 'الطبيب غير موجود'
    });
  }

  if (req.body.name !== undefined) {
    doctor.name = req.body.name;
  }

  if (req.body.consultation_percent !== undefined) {
    doctor.consultation_percent =
      Number(req.body.consultation_percent) || 0;
  }

  if (req.body.tests_percent !== undefined) {
    doctor.tests_percent =
      Number(req.body.tests_percent) || 0;
  }

  if (req.body.xray_percent !== undefined) {
    doctor.xray_percent =
      Number(req.body.xray_percent) || 0;
  }

  if (req.body.booking_percent !== undefined) {
    doctor.booking_percent =
      Number(req.body.booking_percent) || 0;
  }

  res.json(doctor);
});

/* =========================
   PATIENTS
========================= */

app.get('/api/reception/search', auth, function (req, res) {
  var q = String(req.query.q || '').toLowerCase();

  var result = patients.filter(function (p) {
    return (
      String(p.file_no || '').toLowerCase().includes(q) ||
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.phone || '').toLowerCase().includes(q)
    );
  });

  res.json(result);
});

app.get('/api/patients', auth, function (req, res) {
  res.json(patients);
});

app.post('/api/patients', auth, function (req, res) {
  var patient = {
    id: nextId(patients),
    file_no:
      req.body.file_no ||
      String(1000 + nextId(patients)),
    name: req.body.name || '',
    phone: req.body.phone || '',
    cin: req.body.cin || '',
    doctor_id: req.body.doctor_id || null,
    doctor_name: req.body.doctor_name || '',
    amount_paid: Number(req.body.amount_paid) || 0,
    service_type: req.body.service_type || '',
    has_appointment: req.body.has_appointment || false,
    appointment_date: req.body.appointment_date || '',
    appointment_time: req.body.appointment_time || '',
    medicines: req.body.medicines || '',
    payment_method: req.body.payment_method || '',
    payment_method_other: req.body.payment_method_other || '',
    created_at: new Date()
  };

  if (!patient.name) {
    return res.status(400).json({
      error: 'اسم المريض مطلوب'
    });
  }

  patients.push(patient);

  if (patient.amount_paid > 0) {
    invoices.push({
      id: nextId(invoices),
      invoice_no: 'INV-' + Date.now(),
      subtotal: patient.amount_paid,
      paid: patient.amount_paid,
      patient_name: patient.name,
      service_type: patient.service_type,
      payment_method:
        patient.payment_method === 'أخرى'
          ? patient.payment_method_other
          : patient.payment_method,
      recorded_by: req.user.name,
      created_at: new Date()
    });
  }

  res.json(patient);
});

app.get('/api/patients/:id', auth, function (req, res) {
  var patient = patients.find(function (p) {
    return p.id == req.params.id;
  });

  if (!patient) {
    return res.status(404).json({
      error: 'المريض غير موجود'
    });
  }

  res.json({
    patient: patient,
    visits: []
  });
});

/* =========================
   ADMIN USERS
========================= */

app.get('/api/admin/users', auth, adminOnly, function (req, res) {
  res.json(users.map(safeUser));
});

app.post('/api/admin/users', auth, adminOnly, function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var role = req.body.role || 'secretary';
  var name = req.body.name || '';

  if (!username || !password) {
    return res.status(400).json({
      error: 'اسم المستخدم وكلمة المرور مطلوبان'
    });
  }

  var exists = users.find(function (u) {
    return u.username === username;
  });

  if (exists) {
    return res.status(400).json({
      error: 'اسم المستخدم موجود'
    });
  }

  var user = {
    id: nextId(users),
    username: username,
    password: bcrypt.hashSync(password, 10),
    role: role,
    name: name,
    active: true
  };

  users.push(user);

  res.json(safeUser(user));
});

app.patch('/api/admin/users/:id', auth, adminOnly, function (req, res) {
  var user = users.find(function (u) {
    return u.id == req.params.id;
  });

  if (!user) {
    return res.status(404).json({
      error: 'المستخدم غير موجود'
    });
  }

  if (req.body.name !== undefined) {
    user.name = req.body.name;
  }

  if (req.body.role !== undefined) {
    user.role = req.body.role;
  }

  if (req.body.active !== undefined) {
    user.active = Boolean(req.body.active);
  }

  if (req.body.password) {
    user.password = bcrypt.hashSync(req.body.password, 10);
  }

  res.json(safeUser(user));
});

/* =========================
   QUEUE
========================= */

app.get('/api/queue', auth, function (req, res) {
  res.json(queue);
});

app.post('/api/queue', auth, function (req, res) {
  var patient = patients.find(function (p) {
    return p.id == req.body.patient_id;
  });

  var item = {
    id: nextId(queue),
    patient_id: req.body.patient_id || null,
    patient_name: patient ? patient.name : 'مريض',
    doctor_id: req.body.doctor_id || null,
    doctor_name: req.body.doctor_name || '',
    status: 'waiting',
    created_at: new Date()
  };

  queue.push(item);

  res.json(item);
});

app.post('/api/queue/:id/status', auth, function (req, res) {
  var item = queue.find(function (q) {
    return q.id == req.params.id;
  });

  if (!item) {
    return res.status(404).json({
      error: 'الحجز غير موجود'
    });
  }

  item.status = req.body.status || item.status;

  res.json(item);
});

app.post('/api/queue/:id/create-visit', auth, function (req, res) {
  var item = queue.find(function (q) {
    return q.id == req.params.id;
  });

  if (!item) {
    return res.status(404).json({
      error: 'الحجز غير موجود'
    });
  }

  item.status = 'completed';

  var amount = Number(req.body.consultation) || 0;
  var paid = Number(req.body.paid) || 0;

  invoices.push({
    id: nextId(invoices),
    invoice_no: 'INV-' + Date.now(),
    subtotal: amount,
    paid: paid,
    patient_name: item.patient_name,
    service_type: 'استشارة',
    payment_method: req.body.payment_method || '',
    recorded_by: req.user.name,
    created_at: new Date()
  });

  res.json({
    ok: true
  });
});/* =========================
   APPOINTMENTS
========================= */

app.get('/api/appointments', auth, function (req, res) {
  res.json(appointments);
});

app.post('/api/appointments/self-book', auth, function (req, res) {
  var doctor = doctors.find(function (d) {
    return d.id == req.body.doctor_id;
  });

  var appointment = {
    id: nextId(appointments),
    patient_id: req.user.patient_id || req.user.id,
    doctor_id: req.body.doctor_id || null,
    doctor_name: doctor ? doctor.name : '',
    date: req.body.date || '',
    time: req.body.time || '',
    notes: req.body.notes || '',
    status: 'pending',
    created_at: new Date()
  };

  appointments.push(appointment);

  res.json(appointment);
});

/* =========================
   INVOICES
========================= */

app.get('/api/invoices', auth, function (req, res) {
  res.json(invoices);
});

/* =========================
   ANNOUNCEMENTS
========================= */

app.get('/api/announcements', auth, function (req, res) {
  res.json(announcements);
});

app.post('/api/announcements', auth, adminOnly, function (req, res) {
  var announcement = {
    id: nextId(announcements),
    title: req.body.title || '',
    content: req.body.content || '',
    created_at: new Date()
  };

  announcements.push(announcement);

  res.json(announcement);
});

/* =========================
   SPECIALTIES
========================= */

app.get('/api/specialties', auth, function (req, res) {
  res.json(specialties);
});

app.post('/api/specialties', auth, adminOnly, function (req, res) {
  var specialty = {
    id: nextId(specialties),
    name: req.body.name || ''
  };

  if (!specialty.name) {
    return res.status(400).json({
      error: 'اسم التخصص مطلوب'
    });
  }

  specialties.push(specialty);

  res.json(specialty);
});

/* =========================
   SERVICES
========================= */

app.get('/api/services', auth, function (req, res) {
  res.json(services);
});

app.post('/api/services', auth, adminOnly, function (req, res) {
  var service = {
    id: nextId(services),
    name: req.body.name || '',
    price: Number(req.body.price) || 0
  };

  if (!service.name) {
    return res.status(400).json({
      error: 'اسم الخدمة مطلوب'
    });
  }

  services.push(service);

  res.json(service);
});

/* =========================
   FINANCIAL REPORT
========================= */

app.get('/api/reports/financial', auth, function (req, res) {
  var revenue = invoices.reduce(function (sum, invoice) {
    return sum + (Number(invoice.subtotal) || 0);
  }, 0);

  var paid = invoices.reduce(function (sum, invoice) {
    return sum + (Number(invoice.paid) || 0);
  }, 0);

  var remaining = revenue - paid;

  res.json({
    totals: {
      revenue: revenue,
      paid: paid,
      remaining: remaining
    }
  });
});

/* =========================
   NOTIFICATIONS
========================= */

app.post('/api/notifications/register', auth, function (req, res) {
  res.json({
    ok: true,
    message: 'تم تسجيل الإشعارات'
  });
});

/* =========================
   START SERVER
========================= */

var PORT = process.env.PORT || 10000;

app.listen(PORT, function () {
  console.log('Server running on ' + PORT);
});