const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://deyvidmunozromero:aetW9fo7fB4S52Gd@backend.nbq5xhj.mongodb.net/?retryWrites=true&w=majority&appName=backend";

// Configurar el cliente de MongoDB
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Conectar a MongoDB y configurar la colección de clientes
let clientesCollection;
client.connect(err => {
  if (err) {
    console.error('Error connecting to MongoDB', err);
    process.exit(1);
  }
  const db = client.db('BACKEND'); // Reemplaza con el nombre de tu base de datos
  clientesCollection = db.collection('clientes');
  console.log('Connected to MongoDB');
});

// Configurar express-session
app.use(session({
  secret: process.env.SESSION_SECRET, // Debes definir una variable SESSION_SECRET en tu archivo .env
  resave: false,
  saveUninitialized: true
}));

app.use(express.static('public'));

// Configurar el middleware de procesamiento de cuerpo
app.use(bodyParser.urlencoded({ extended: true })); // Para procesar datos de formularios
app.use(bodyParser.json()); // Para procesar datos JSON

// Configurar la estrategia de OAuth de Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  (accessToken, refreshToken, profile, done) => {
    // Lógica para manejar el perfil de usuario después de la autenticación exitosa
    return done(null, profile);
  }
));

// Serializar y deserializar el usuario
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Configurar express y Passport
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
  res.redirect('/login');
});

// Ruta de inicio de sesión que redirige al inicio de sesión de Google
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/registro.html', (req, res) => {
  res.sendFile(__dirname + '/registro.html');
});

app.get('/compras.html', (req, res) => {
  res.sendFile(__dirname + '/compras.html');
});

// Ruta de autenticación de Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Ruta de retorno de Google OAuth
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    // Autenticación exitosa
    const userId = req.user.id;
    const userEmail = req.user.emails[0].value; // Asegúrate de obtener el correo electrónico correctamente

    // Almacenar el ID único del usuario en la variable de sesión
    req.session.userId = userId;

    try {
      // Consultar si el usuario ya está presente en la colección de clientes
      const user = await clientesCollection.findOne({ cliente_id: userId });

      if (!user) {
        // El usuario no está presente en la colección de clientes, redirigir a la página de registro
        return res.redirect(`/registro.html?userId=${userId}&userName=${req.user.displayName}&userEmail=${userEmail}`);
      } else {
        // El usuario ya está presente en la colección de clientes, redirigir a la página principal de compras
        return res.redirect('/compras.html');
      }
    } catch (error) {
      console.error('Error querying MongoDB', error);
      // Manejar errores
      return res.redirect('/login');
    }
  }
);

app.post('/mandarRegistro', async (req, res) => {
  const { nombre, telefono, userId, contrasena, correo } = req.body;

  try {
    // Insertar el nuevo usuario en la colección de clientes
    await clientesCollection.insertOne({
      cliente_id: userId,
      nombre: nombre,
      email: correo,
      contrasena: contrasena,
      telefono: telefono,
      fecha_registro: new Date()
    });

    // Redirigir al usuario a la página principal de compras
    res.redirect('/compras.html');
  } catch (error) {
    console.error('Error al insertar datos del usuario:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// Iniciar el servidor
const port = 3000;
app.listen(port, () => {
  console.log(`Servidor Node.js corriendo en el puerto ${port}`);
});
