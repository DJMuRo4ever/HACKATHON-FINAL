$(document).ready(function() {
    // Hacer una solicitud AJAX para obtener los productos del servidor
    $.ajax({
        url: '/productos', // Ruta en el servidor para obtener los productos
        method: 'GET',
        success: function(data) {
            // Cuando se reciban los datos exitosamente, actualizar la lista de productos en la página HTML
            const listaProductos = $('#lista-productos');

            // Iterar sobre los datos recibidos y agregar cada producto a la lista
            data.forEach(function(producto) {
                // Crear un elemento de lista y agregar información del producto
                const li = $('<li>').text(producto.nombre + ' - ' + producto.precio);
                listaProductos.append(li);
            });
        },
        error: function(err) {
            // Manejar errores
            console.error('Error al obtener los productos:', err);
        }
    });
});
