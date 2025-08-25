// server.js - Tu Back-end en Node.js

// Paso 1: Importar las herramientas necesarias. 'express' es un framework que facilita la creación de servidores y APIs.
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000; // Hostinger nos dará el puerto a usar

// Hacemos que nuestro servidor pueda entender datos JSON y de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- BASE DE DATOS EN MEMORIA (Versión simple para empezar) ---
// Para no complicarnos aún con una base de datos real, guardaremos todo en la memoria del servidor.
// ADVERTENCIA: Estos datos se reiniciarán si el servidor se apaga o reinicia.
let visit_counts = {}; // Objeto para contar visitas por página. ej: { "/": 120, "/servicios": 85 }
let messages = [];     // Array para guardar los mensajes del formulario de contacto.
let online_users = new Set(); // Un Set para guardar IPs de usuarios activos y no repetirlos.

// --- LÓGICA PRINCIPAL ---

// Middleware: Una función que se ejecuta en CADA petición que llega al servidor.
// La usaremos para contar visitas y usuarios online.
app.use((req, res, next) => {
    // 1. Contar visitas por página
    const page = req.path;
    visit_counts[page] = (visit_counts[page] || 0) + 1;

    // 2. Rastrear usuarios online (por IP)
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    online_users.add(userIp);
    // Limpiamos la lista cada 5 minutos para eliminar usuarios inactivos
    setTimeout(() => {
        online_users.delete(userIp);
    }, 300000); // 5 minutos en milisegundos

    next(); // Le decimos a Express que continúe con la siguiente función
});

// --- DEFINICIÓN DE LAS APIs ---

// API Endpoint [POST] para recibir mensajes del formulario de contacto
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    
    // Creamos un nuevo objeto de mensaje
    const newMessage = {
        id: Date.now(), // ID único basado en la fecha
        name,
        email,
        subject,
        message,
        date: new Date().toISOString(),
        status: { type: 'warning', text: 'Pendiente' }
    };

    messages.unshift(newMessage); // Añadimos el mensaje al principio de la lista
    console.log('Nuevo mensaje recibido:', newMessage);
    
    // Enviamos una respuesta de éxito
    res.status(200).json({ success: true, message: 'Mensaje recibido correctamente.' });
});

// API Endpoint [GET] que tu panel de administración llamará para obtener todos los datos
app.get('/api/dashboard-data', (req, res) => {
    const total_visits = Object.values(visit_counts).reduce((sum, count) => sum + count, 0);
    const conversion_rate = total_visits > 0 ? ((messages.length / total_visits) * 100).toFixed(1) : 0;

    const data = {
        messages: {
            total: messages.length,
            weekly: messages.filter(m => new Date(m.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
            list: messages.slice(0, 10) // Enviamos solo los últimos 10 para no sobrecargar
        },
        onlineUsers: online_users.size,
        visits: {
            today: visit_counts['/'] || 0, // Simplificado a visitas al home, puedes mejorarlo
            change: 0 // Calcular el cambio requeriría guardar datos históricos
        },
        conversionRate: conversion_rate,
        recentActivity: [
             // Puedes generar esta lista a partir de los últimos mensajes o visitas
            ...messages.slice(0, 2).map(m => ({ user: m.email, action: 'Envió un mensaje', timestamp: m.date })),
            { user: 'Visitante', action: `Vio la página ${Object.keys(visit_counts).pop() || ''}`, timestamp: new Date().toISOString() }
        ]
    };

    res.json(data);
});


// Servimos los archivos estáticos de tu sitio principal (index.html, css, etc.)
// Asumiendo que tu back-end está en una carpeta y tu sitio en 'public_html'
app.use(express.static(path.join(__dirname, '../public_html')));

// Finalmente, iniciamos el servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});