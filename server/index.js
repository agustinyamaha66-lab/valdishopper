// server/index.js
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const app = express();
const { Pool } = pg;

// 1. Conexión a Render (La URL te la da Render al crear la DB)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Necesario para Render
});

app.use(cors());
app.use(express.json());

// 2. Endpoint de Login (Reemplaza a supabase.auth.signInWithPassword)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Buscar usuario en TU tabla de usuarios (ya no la de Supabase)
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    // Verificar contraseña (asumiendo que las hasheaste, si no, compara directo por ahora)
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta' });

    // Crear token
    const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({ token, user: { id: user.id, email: user.email, rol: user.rol } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

// 3. Endpoint de Datos (Reemplaza a supabase.from('perfiles').select('*'))
app.get('/api/perfil/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM perfiles WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));