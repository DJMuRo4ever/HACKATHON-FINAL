const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const bodyParser = require('body-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const uri = process.env.MONGO_URI; // Mejor si la URI está en el .env
let clientesCollection;

// Configurar MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectToMongoDB() {
  try {
    // Conectar al servidor de MongoDB
    await client.connect();
    const db = client.db('BACKEND'); // Reemplaza con el nombre de tu base de datos
    clientesCollection = db.collection('USUARIOS');
    console.log('Connected to MongoDB and the USUARIOS collection');
  } catch (err) {
    console.error('Error connecting to MongoDB', err);
    process.exit(1); // Salir si no se puede conectar
  }
}

// Llama a la función para conectarse a MongoDB
connectToMongoDB();

// Configurar express-session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));

app.use(express.static('public'));

// Configurar el middleware de procesamiento de cuerpo
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configurar la estrategia de OAuth de Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  (accessToken, refreshToken, profile, done) => {
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

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    const userId = req.user.id;
    const userEmail = req.user.emails[0].value;

    req.session.userId = userId;

    try {
      const user = await clientesCollection.findOne({ cliente_id: userId });

      if (!user) {
        return res.redirect(`/registro.html?userId=${userId}&userName=${req.user.displayName}&userEmail=${userEmail}`);
      } else {
        return res.redirect(`/compras.html?userId=${userId}`);
      }
    } catch (error) {
      console.error('Error querying MongoDB', error);
      return res.redirect('/login');
    }
  }
);


app.post('/mandarRegistro', async (req, res) => {
  const { nombre, telefono, userId, contrasena, correo } = req.body;

  try {
    await clientesCollection.insertOne({
      cliente_id: userId,
      nombre: nombre,
      email: correo,
      contrasena: contrasena,
      telefono: telefono,
      fecha_registro: new Date()
    });

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
