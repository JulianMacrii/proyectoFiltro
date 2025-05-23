require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const proxyRoutes = require('./routes/proxyRoutes');

const app = express();
const PORT = 3003;

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ secret: 'secreto123', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.use('/', authRoutes);
app.use('/', proxyRoutes);

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
