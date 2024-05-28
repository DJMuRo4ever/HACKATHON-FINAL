const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const bodyParser = require('body-parser'); // Importa body-parser
const async = require('async');
require('dotenv').config();
const app = express();
const mysql = require('mysql');

// Configurar la conexión a la base de datos MySQL
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Conectar a la base de datos MySQL
connection.connect((error) => {
  if (error) {
    console.error('Error al conectar a la base de datos:', error);
    return;
  }
  console.log('Conexión a la base de datos MySQL establecida correctamente');
});

// Asegúrate de exportar la conexión para que esté disponible en otros módulos si es necesario
module.exports = connection;



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

// Ruta de inicio de sesión que redirige al inicio de sesión de Google
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/registro.html', (req, res) => {
    // Código para enviar la página principal
    res.sendFile(__dirname + '/registro.html');
  });

  app.get('/compras.html', (req, res) => {
    // Redirigir al HTML de compras y pasar el ID de usuario como parámetro de consulta
    res.sendFile(__dirname + `/compras.html`);
});


// Ruta para cargar los productos desde la base de datos
app.get('/cargar-productos', (req, res) => {
    // Consultar la base de datos para obtener la lista de productos
    connection.query('SELECT * FROM productos', (error, results) => {
        if (error) {
            console.error('Error al cargar los productos:', error);
            return res.status(500).send('Error interno del servidor');
        }

        // Éxito: enviar la lista de productos como JSON
        res.json(results);
    });
});


app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);


// Ruta de retorno de Google OAuth
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Autenticación exitosa
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Almacenar el ID único del usuario en la variable de sesión
    req.session.userId = userId;

    // Consultar si el usuario ya está presente en la tabla de clientes
    connection.query('SELECT * FROM clientes WHERE cliente_id = ?', [userId], (error, results) => {
      if (error) {
        // Manejar errores
        return res.redirect('/login');
      }

      if (results.length === 0) {
        // El usuario no está presente en la tabla de clientes, redirigir a la página de registro
        return res.redirect(`/registro.html?userId=${userId}&userName=${req.user.displayName}&userEmail=${userEmail}`);
      } else {
        // El usuario ya está presente en la tabla de clientes, redirigir a la página principal de compras
        return res.redirect('/compras.html');
      }
    });
  }
);


// Ruta para obtener el nombre de usuario asociado al ID único del usuario
app.get('/obtenerNombre', (req, res) => {
    // Obtener el ID único del usuario de la variable de sesión
    const userId = req.session.userId;

    // Realizar la consulta a la base de datos para obtener el nombre de usuario asociado al ID
    connection.query('SELECT nombre FROM clientes WHERE cliente_id = ?', [userId], (error, results) => {
        if (error) {
            // Manejar el error si ocurre
            console.error('Error al obtener el nombre de usuario:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        // Verificar si se encontraron resultados
        if (results.length === 0) {
            // El usuario no fue encontrado en la base de datos
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Obtener el nombre de usuario de los resultados de la consulta
        const nombreUsuario = results[0].nombre;

        // Enviar el nombre de usuario como respuesta
        res.json({ nombreUsuario });
    });
});




app.post('/mandarRegistro', (req, res) => {
    const { nombre, telefono, userId,contrasena,correo } = req.body;

    // Realizar la inserción de datos en la base de datos
    connection.query('INSERT INTO clientes (cliente_id, nombre,email,contrasena, telefono) VALUES (?, ?, ?,?,?)', [userId, nombre, correo,contrasena,telefono], (error, results) => {
        if (error) {
            console.error('Error al insertar datos del usuario:', error);
            return res.status(500).send('Error interno del servidor');
        }

        // Redirigir al usuario a la página principal de compras
        res.redirect('/compras.html');
    });
});

// Ruta para agregar un producto al carrito
app.post('/agregar-al-carrito', (req, res) => {
    // Obtener el ID de usuario de la variable de sesión
    const userId = req.session.userId;

    // Obtener el nombre del producto del cuerpo de la solicitud
    const productName = req.body.productName;

    // Buscar el ID del producto en la base de datos
    connection.query('SELECT id FROM productos WHERE nombre = ?', [productName], (error, results) => {
        if (error) {
            // Manejar errores
            console.error('Error al buscar ID del producto:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (results.length === 0) {
            // El producto no se encontró en la base de datos
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Obtener el ID del producto
        const productId = results[0].id;

        // Insertar el producto en la tabla de carrito
        connection.query('INSERT INTO carrito (cliente_id, producto_id) VALUES (?, ?)', [userId, productId], (error, results) => {
            if (error) {
                // Manejar errores
                console.error('Error al insertar producto en el carrito:', error);
                return res.status(500).json({ error: 'Error interno del servidor' });
            }

            // Éxito, producto agregado al carrito
            res.json({ message: 'Producto agregado al carrito correctamente' });
        });
    });
});


// Ruta para cargar la lista completa del carrito asociado al ID de usuario de sesión
app.get('/cargar-carrito', (req, res) => {
    const userId = req.session.userId; // Obtener el ID de usuario de sesión
    // Realizar una consulta para obtener los registros del carrito del usuario actual
connection.query('SELECT * FROM carrito WHERE cliente_id = ?', [userId], (error, carritoResults) => {
    if (error) {
        console.error('Error al cargar el carrito:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Array para almacenar los detalles del carrito, incluidos los nombres de los productos
    const carrito = [];

    // Recorrer los registros del carrito y obtener el nombre del producto para cada uno
    async.eachSeries(carritoResults, (item, callback) => {
        const productId = item.producto_id; // Corregido

        // Consultar la tabla producto para obtener el nombre del producto
        connection.query('SELECT nombre FROM productos WHERE id = ?', [productId], (error, productoResult) => {
            if (error) {
                // Si hay un error en la consulta, pasar al siguiente registro del carrito
                console.error('Error al cargar el nombre del producto:', error);
                return callback();
            }

            // Agregar el nombre del producto al detalle del carrito
            const productoNombre = productoResult[0].nombre;
            carrito.push({
                idProducto: productId,
                nombre: productoNombre,
                cantidad: item.cantidad
            });

            // Pasar al siguiente registro del carrito
            callback();
        });
    }, (err) => {
        if (err) {
            console.error('Error al cargar los productos del carrito:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        // Enviar los detalles del carrito como respuesta
        res.json({ carrito });
    });
});


});




// Iniciar el servidor
const port = 3000;
app.listen(port, () => {
  console.log(`Servidor Node.js corriendo en el puerto ${port}`);
});