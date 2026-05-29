const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data'); // 🔥 FALTABA ESTO
require('dotenv').config();

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Archivo recibido:', req.file);

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    const formData = new FormData();
    formData.append('file', req.file.buffer, req.file.originalname);

    if (req.body.title) formData.append('title', req.body.title);
    if (req.body.description) formData.append('description', req.body.description);

    const response = await axios.post(
      'https://upload.zerostorage.net/api/upload/universal',
      formData,
      {
        headers: {
          'x-api-key': process.env.ZERO_API_KEY,
          ...formData.getHeaders()
        }
      }
    );

    console.log('Respuesta API:', response.data);

    res.json(response.data);

  } catch (error) {
    console.error('ERROR:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error subiendo archivo' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor corriendo en http://localhost:' + (process.env.PORT || 3000));
});