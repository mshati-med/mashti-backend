
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
app.use(cors());
app.use(express.json());
const SECRET = 'mashti-secret-2026';

let users = [
  {id:1, username:'admin', password:bcrypt.hashSync('admin123',10), role:'admin', name:'المدير'},
  {id:2, username:'doctor1', password:bcrypt.hashSync('123456',10), role:'doctor', name:'د. أحمد'},
  {id:3, username:'secretary', password:bcrypt.hashSync('123456',10), role:'secretary', name:'السكرتيرة'}
];
let doctors = [{id:1,name:'د. أحمد - عام'},{id:2,name:'د. فاطمة - أسنان'}];
let patients = [{id:1,file_no:'1001',name:'محمد سالم',phone:'22222222',cin:'123456'}];
let queue = [];
let appointments = [];
let invoices = [{id:1,invoice_no:'INV-001',subtotal:500,paid:300,patient_name:'محمد سالم'}];
let announcements = [{id:1,title:'دوام المصحة من 8 صباحا حتى 8 مساء'}];
let specialties = [{id:1,name:'طب عام'},{id:2,name:'أسنان'}];
let services = [{id:1,name:'تحليل دم'},{id:2,name:'أشعة'}];

function auth(req,res,next){
  const h=req.headers.authorization;
  if(!h) return res.status(401).json({error:'no token'});
  try{ req.user=jwt.verify(h.replace('Bearer ','') ,SECRET); next(); }catch(e){ return res.status(401).json({error:'invalid'}); }
}

app.get('/', (req,res)=> res.send('Mashti Backend is Running!'));

app.post('/api/auth/login',(req,res)=>{
  const {username,password}=req.body;
  const u=users.find(x=>x.username===username);
  if(!u || !bcrypt.compareSync(password,u.password)) return res.status(401).json({error:'خطأ في الدخول'});
  const token=jwt.sign({id:u.id,role:u.role},SECRET);
  res.json({token,user:u});
});

app.post('/api/auth/register-patient',(req,res)=>{
  const {file_no,phone,username,password}=req.body;
  const pat=patients.find(p=>p.file_no===file_no && p.phone===phone);
  if(!pat) return res.status(404).json({error:'رقم الملف أو الهاتف غير موجود'});
  if(users.find(u=>u.username===username)) return res.status(400).json({error:'اسم المستخدم موجود'});
  const nu={id:users.length+1,username,password:bcrypt.hashSync(password,10),role:'patient',patient_id:pat.id,name:pat.name};
  users.push(nu);
  const token=jwt.sign({id:nu.id,role:'patient'},SECRET);
  res.json({token,user:nu});
});

app.get('/api/doctors',auth,(req,res)=>res.json(doctors));
app.get('/api/reception/search',auth,(req,res)=>{ const q=(req.query.q||'').toLowerCase(); res.json(patients.filter(p=>p.file_no.includes(q)||p.name.toLowerCase().includes(q))); });
app.get('/api/patients',auth,(req,res)=>res.json(patients));
app.get('/api/patients/:id',auth,(req,res)=>res.json({patient:patients.find(p=>p.id==req.params.id),visits:[]}));
app.get('/api/queue',auth,(req,res)=>res.json(queue));
app.post('/api/queue',auth,(req,res)=>{ const q={id:Date.now(),...req.body,status:'waiting',patient_name:patients.find(p=>p.id==req.body.patient_id)?.name||'مريض',created_at:new Date()}; queue.push(q); res.json(q); });
app.post('/api/queue/:id/status',auth,(req,res)=>{ const q=queue.find(x=>x.id==req.params.id); if(q) q.status=req.body.status; res.json(q); });
app.post('/api/queue/:id/create-visit',auth,(req,res)=>{ const q=queue.find(x=>x.id==req.params.id); if(q) q.status='completed'; invoices.push({id:Date.now(),invoice_no:'INV-'+Date.now(),subtotal:req.body.consultation,paid:req.body.paid,patient_name:q?.patient_name}); res.json({ok:true}); });
app.get('/api/appointments',auth,(req,res)=>res.json(appointments));
app.post('/api/appointments/self-book',auth,(req,res)=>{ const a={id:Date.now(),...req.body,