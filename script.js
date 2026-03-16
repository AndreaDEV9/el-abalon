
// variables, funciones, comentarios

'use strict';

/* RUTAS DE LA API*/
const RUTAS_API = {
  menu:           'api/menu.php',
  reservas:       'api/reservas.php',
  pedidos:        'api/pedidos.php',
  autenticacion:  'api/autenticacion.php',
};

const COSTO_DELIVERY = 5.00;

/* ESTADO GLOBAL DE LA APLICACION */
const estadoApp = {
  listaCategorias:    [],
  listaPlatos:        [],
  listaBebidas:       [],
  carritoItems:       [],
  platoActual:        null,
  cantidadPlatoModal: 1,
  cantidadBebidas:    {},         // { idBebida: cantidad }
  esDelivery:         false,
  usuarioSesion:      null,       // { id, nombre_completo, correo_electronico }
  idDepartamentoSeleccionado: null,
  idProvinciaSeleccionada:    null,
  idDistritoSeleccionado:     null,
  datosReserva: {
    fechaSeleccionada: null,
    horaSeleccionada:  null,
    idMesaSeleccionada:null,
  },
  listaMesas:         [],
  horariosActuales:   [],
  fechaCalendario:    new Date(),
};

/* ─── UTILIDADES GENERALES ───────────────────────── */
const obtenerElemento   = id  => document.getElementById(id);
const mostrarElemento   = id  => { const el = typeof id === 'string' ? obtenerElemento(id) : id; if (el) el.classList.remove('oculto'); };
const ocultarElemento   = id  => { const el = typeof id === 'string' ? obtenerElemento(id) : id; if (el) el.classList.add('oculto'); };
const alternarVisibilidad = (elemento, condicion) => condicion ? mostrarElemento(elemento) : ocultarElemento(elemento);
const formatearPrecio   = monto => 'S/ ' + Number(monto).toFixed(2);

/* ─── LLAMADA A LA API ───────────────────────────── */
async function llamarAPI(ruta, parametros = {}, metodo = 'GET', cuerpo = null) {
  const queryString = new URLSearchParams(parametros).toString();
  const urlCompleta = queryString ? `${ruta}?${queryString}` : ruta;

  const opciones = {
    method:  metodo,
    headers: { 'Content-Type': 'application/json' },
  };
  if (cuerpo) opciones.body = JSON.stringify(cuerpo);

  const respuesta = await fetch(urlCompleta, opciones);
  const datos     = await respuesta.json();

  if (!datos.correcto) throw new Error(datos.mensaje || 'Error en la API');
  return datos;
}

/* ─── NOTIFICACION FLOTANTE (TOAST) ─────────────── */
function mostrarNotificacion(mensaje, duracion = 2800) {
  const notificacion = obtenerElemento('notificacionFlotante');
  notificacion.textContent = mensaje;
  notificacion.classList.remove('oculto');
  setTimeout(() => notificacion.classList.add('visible'), 10);
  setTimeout(() => {
    notificacion.classList.remove('visible');
    setTimeout(() => notificacion.classList.add('oculto'), 320);
  }, duracion);
}

/* ─── INICIALIZACION DE LA APLICACION ───────────── */
async function inicializarAplicacion() {
  obtenerElemento('grillaDePlatos').innerHTML =
    '<div class="mensaje-cargando">Cargando carta...</div>';

  try {
    const [respCategorias, respBebidas, respMesas] = await Promise.all([
      llamarAPI(RUTAS_API.menu,     { accion: 'categorias' }),
      llamarAPI(RUTAS_API.menu,     { accion: 'bebidas' }),
      llamarAPI(RUTAS_API.reservas, { accion: 'mesas' }),
    ]);

    estadoApp.listaCategorias = respCategorias.datos;
    estadoApp.listaBebidas    = respBebidas.datos;
    estadoApp.listaMesas      = respMesas.datos;

    construirBarraCategorias();
    await cargarPlatos();
    await cargarDepartamentos();

  } catch (error) {
    obtenerElemento('grillaDePlatos').innerHTML =
      `<div class="mensaje-error">${error.message}<br><small>Verifica que XAMPP este activo y la base de datos importada.</small></div>`;
  }
}

/* ─── BARRA DE FILTRO POR CATEGORIAS ────────────── */
function construirBarraCategorias() {
  let barraExistente = obtenerElemento('barraCategoriasPlatos');
  if (!barraExistente) {
    barraExistente = document.createElement('div');
    barraExistente.id        = 'barraCategoriasPlatos';
    barraExistente.className = 'barra-categorias';
    document.querySelector('#seccionMenu .cabecera-seccion').after(barraExistente);
  }

  const pastillaTodos = `<button class="pastilla-categoria activo" data-id-categoria="">Todos</button>`;
  const pastillas = estadoApp.listaCategorias.map(categoria =>
    `<button class="pastilla-categoria" data-id-categoria="${categoria.id}">${categoria.nombre}</button>`
  ).join('');

  barraExistente.innerHTML = pastillaTodos + pastillas;

  barraExistente.querySelectorAll('.pastilla-categoria').forEach(pastilla => {
    pastilla.addEventListener('click', () => {
      barraExistente.querySelectorAll('.pastilla-categoria').forEach(p => p.classList.remove('activo'));
      pastilla.classList.add('activo');
      const idCategoria = pastilla.dataset.idCategoria || null;
      cargarPlatos(idCategoria);
    });
  });
}

/* ─── CARGAR PLATOS DESDE LA API ─────────────────── */
async function cargarPlatos(idCategoria = null) {
  obtenerElemento('grillaDePlatos').innerHTML =
    '<div class="mensaje-cargando">Cargando platos...</div>';
  try {
    const parametros = { accion: 'platos' };
    if (idCategoria) parametros.categoria = idCategoria;

    const respuesta = await llamarAPI(RUTAS_API.menu, parametros);
    estadoApp.listaPlatos = respuesta.datos;
    renderizarTarjetasPlatos();
  } catch (error) {
    obtenerElemento('grillaDePlatos').innerHTML =
      `<div class="mensaje-error">${error.message}</div>`;
  }
}

/* ─── RENDERIZAR TARJETAS DE PLATOS ─────────────── */
function renderizarTarjetasPlatos() {
  const grilla = obtenerElemento('grillaDePlatos');

  if (!estadoApp.listaPlatos.length) {
    grilla.innerHTML = '<div class="carrito-vacio">No hay platos disponibles en esta categoria.</div>';
    return;
  }

  grilla.innerHTML = estadoApp.listaPlatos.map(plato => `
    <div class="tarjeta-plato" data-id-plato="${plato.id}">
      <img
        src="${plato.url_imagen}"
        alt="${plato.nombre}"
        loading="lazy"
        onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=60'"
      />
      <div class="tarjeta-plato__cuerpo">
        <div class="tarjeta-plato__categoria">${plato.nombre_categoria ?? ''}</div>
        <div class="tarjeta-plato__nombre">${plato.nombre}</div>
        <div class="tarjeta-plato__descripcion">${plato.descripcion}</div>
        <div class="tarjeta-plato__precio">S/ ${Number(plato.precio).toFixed(2)}</div>
      </div>
    </div>
  `).join('');

  grilla.querySelectorAll('.tarjeta-plato').forEach(tarjeta => {
    tarjeta.addEventListener('click', () => {
      abrirModalDetallePlato(Number(tarjeta.dataset.idPlato));
    });
  });
}

/* ─── MODAL DE DETALLE DEL PLATO ─────────────────── */
function abrirModalDetallePlato(idPlato) {
  const plato = estadoApp.listaPlatos.find(p => p.id === idPlato);
  if (!plato) return;

  estadoApp.platoActual        = plato;
  estadoApp.cantidadPlatoModal = 1;
  estadoApp.cantidadBebidas    = {};

  obtenerElemento('imagenModalPlato').src           = plato.url_imagen;
  obtenerElemento('imagenModalPlato').alt           = plato.nombre;
  obtenerElemento('categoriaModalPlato').textContent= plato.nombre_categoria ?? '';
  obtenerElemento('nombreModalPlato').textContent   = plato.nombre;
  obtenerElemento('descripcionModalPlato').textContent = plato.descripcion;
  obtenerElemento('precioModalPlato').textContent   = Number(plato.precio).toFixed(2);
  obtenerElemento('valorCantidadPlato').textContent = 1;
  obtenerElemento('especificacionesPlato').value    = '';

  actualizarLimiteBebidas();
  renderizarListaBebidas();
  mostrarElemento('modalDetallePlato');
}

function actualizarLimiteBebidas() {
  const limiteActual = estadoApp.cantidadPlatoModal * 2;
  obtenerElemento('cantidadMaximaBebidas').textContent = limiteActual;
}

function obtenerTotalBebidasSeleccionadas() {
  return Object.values(estadoApp.cantidadBebidas).reduce((acum, cant) => acum + cant, 0);
}

function renderizarListaBebidas() {
  const contenedorBebidas = obtenerElemento('listaDeBebidas');
  const limiteBebidas     = estadoApp.cantidadPlatoModal * 2;
  const totalSeleccionado = obtenerTotalBebidasSeleccionadas();

  const gruposBebidas = [
    { etiqueta: 'Gaseosas personales', tipo: 'gaseosa'  },
    { etiqueta: 'Chichas',             tipo: 'chicha'   },
    { etiqueta: 'Agua',                tipo: 'agua'     },
    { etiqueta: 'Cervezas',            tipo: 'cerveza'  },
  ];

  contenedorBebidas.innerHTML = gruposBebidas.map(grupo => {
    const bebidasDelGrupo = estadoApp.listaBebidas.filter(b => b.tipo_bebida === grupo.tipo);
    if (!bebidasDelGrupo.length) return '';

    const filasHTML = bebidasDelGrupo.map(bebida => {
      const cantidadActual = estadoApp.cantidadBebidas[bebida.id] || 0;
      const puedeAgregar   = totalSeleccionado < limiteBebidas;

      return `
        <div class="fila-bebida">
          <div class="fila-bebida__informacion">
            <span class="fila-bebida__nombre">${bebida.nombre}</span>
            <span class="fila-bebida__precio">S/ ${Number(bebida.precio).toFixed(2)}</span>
          </div>
          <div class="control-cantidad">
            <button class="boton-cantidad boton-disminuir-bebida"
                    data-id-bebida="${bebida.id}"
                    ${cantidadActual === 0 ? 'disabled' : ''}>-</button>
            <span>${cantidadActual}</span>
            <button class="boton-cantidad boton-aumentar-bebida"
                    data-id-bebida="${bebida.id}"
                    ${!puedeAgregar ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
    }).join('');

    return `<div class="titulo-subseccion" style="font-size:.8rem;margin-bottom:6px">${grupo.etiqueta}</div>${filasHTML}`;
  }).join('');

  // Eventos para los botones de bebidas
  contenedorBebidas.querySelectorAll('.boton-disminuir-bebida').forEach(boton => {
    boton.addEventListener('click', () => {
      const idBebida = Number(boton.dataset.idBebida);
      if ((estadoApp.cantidadBebidas[idBebida] || 0) > 0) {
        estadoApp.cantidadBebidas[idBebida]--;
        renderizarListaBebidas();
      }
    });
  });

  contenedorBebidas.querySelectorAll('.boton-aumentar-bebida').forEach(boton => {
    boton.addEventListener('click', () => {
      const idBebida      = Number(boton.dataset.idBebida);
      const limiteBebidas = estadoApp.cantidadPlatoModal * 2;
      if (obtenerTotalBebidasSeleccionadas() < limiteBebidas) {
        estadoApp.cantidadBebidas[idBebida] = (estadoApp.cantidadBebidas[idBebida] || 0) + 1;
        renderizarListaBebidas();
      }
    });
  });
}

// Controles de cantidad del plato en el modal
obtenerElemento('disminuirCantidadPlato').addEventListener('click', () => {
  if (estadoApp.cantidadPlatoModal > 1) {
    estadoApp.cantidadPlatoModal--;
    obtenerElemento('valorCantidadPlato').textContent = estadoApp.cantidadPlatoModal;
    actualizarLimiteBebidas();

    // Recortar bebidas si superan el nuevo limite
    const nuevoLimite = estadoApp.cantidadPlatoModal * 2;
    for (const id of Object.keys(estadoApp.cantidadBebidas)) {
      while (obtenerTotalBebidasSeleccionadas() > nuevoLimite && estadoApp.cantidadBebidas[id] > 0) {
        estadoApp.cantidadBebidas[id]--;
      }
    }
    renderizarListaBebidas();
  }
});

obtenerElemento('aumentarCantidadPlato').addEventListener('click', () => {
  estadoApp.cantidadPlatoModal++;
  obtenerElemento('valorCantidadPlato').textContent = estadoApp.cantidadPlatoModal;
  actualizarLimiteBebidas();
  renderizarListaBebidas();
});

obtenerElemento('cerrarModalPlato').addEventListener('click', () => ocultarElemento('modalDetallePlato'));
obtenerElemento('modalDetallePlato').addEventListener('click', evento => {
  if (evento.target === obtenerElemento('modalDetallePlato')) ocultarElemento('modalDetallePlato');
});

// Agregar plato al carrito
obtenerElemento('botonAgregarAlCarrito').addEventListener('click', () => {
  const plato         = estadoApp.platoActual;
  const cantidad      = estadoApp.cantidadPlatoModal;
  const especificaciones = obtenerElemento('especificacionesPlato').value.trim();

  const bebidasSeleccionadas = Object.entries(estadoApp.cantidadBebidas)
    .filter(([, cantBebida]) => cantBebida > 0)
    .map(([id, cantBebida]) => ({
      bebida:    estadoApp.listaBebidas.find(b => b.id === Number(id)),
      cantidad:  cantBebida,
    }));

  const totalBebidas = bebidasSeleccionadas.reduce(
    (suma, { bebida, cantidad: cant }) => suma + Number(bebida.precio) * cant, 0
  );
  const precioTotal = Number(plato.precio) * cantidad + totalBebidas;

  estadoApp.carritoItems.push({
    plato,
    cantidad,
    bebidasSeleccionadas,
    especificaciones,
    precioTotal,
  });

  actualizarContadorCarrito();
  ocultarElemento('modalDetallePlato');
  mostrarNotificacion('Plato agregado al carrito correctamente');
});

/* ─── CARRITO DE COMPRAS ─────────────────────────── */
function actualizarContadorCarrito() {
  const totalArticulos = estadoApp.carritoItems.reduce((suma, item) => suma + item.cantidad, 0);
  obtenerElemento('contadorCarrito').textContent = totalArticulos;
}

obtenerElemento('botonCarrito').addEventListener('click', abrirModalCarrito);
obtenerElemento('cerrarModalCarrito').addEventListener('click', () => ocultarElemento('modalCarrito'));
obtenerElemento('modalCarrito').addEventListener('click', evento => {
  if (evento.target === obtenerElemento('modalCarrito')) ocultarElemento('modalCarrito');
});

function abrirModalCarrito() {
  renderizarArticulosCarrito();
  recalcularTotales();
  mostrarElemento('modalCarrito');
}

function renderizarArticulosCarrito() {
  const contenedor = obtenerElemento('articulosCarrito');

  if (!estadoApp.carritoItems.length) {
    contenedor.innerHTML = '<div class="carrito-vacio">Tu carrito esta vacio</div>';
    return;
  }

  contenedor.innerHTML = estadoApp.carritoItems.map((item, indice) => {
    const textoBebidas = item.bebidasSeleccionadas.length
      ? item.bebidasSeleccionadas.map(b => `${b.cantidad}x ${b.bebida.nombre}`).join(', ')
      : 'Sin bebidas';
    const textoEspecificaciones = item.especificaciones
      ? `<br>Especificacion: ${item.especificaciones}`
      : '';

    return `
      <div class="articulo-carrito">
        <div class="articulo-carrito__cabecera">
          <div class="articulo-carrito__nombre">${item.plato.nombre}</div>
          <div class="articulo-carrito__precio">${formatearPrecio(item.precioTotal)}</div>
        </div>
        <div class="articulo-carrito__extras">
          Bebidas: ${textoBebidas}${textoEspecificaciones}
        </div>
        <div class="articulo-carrito__controles">
          <div class="control-cantidad">
            <button class="boton-cantidad boton-disminuir-carrito" data-indice="${indice}">-</button>
            <span>${item.cantidad}</span>
            <button class="boton-cantidad boton-aumentar-carrito"  data-indice="${indice}">+</button>
          </div>
          <button class="boton-eliminar" data-indice="${indice}">Eliminar</button>
        </div>
      </div>`;
  }).join('');

  // Eventos botones cantidad en carrito
  contenedor.querySelectorAll('.boton-disminuir-carrito').forEach(boton => {
    boton.addEventListener('click', () => {
      const indice = Number(boton.dataset.indice);
      if (estadoApp.carritoItems[indice].cantidad > 1) {
        estadoApp.carritoItems[indice].cantidad--;
        recalcularPrecioArticulo(indice);
        renderizarArticulosCarrito();
        recalcularTotales();
        actualizarContadorCarrito();
      }
    });
  });

  contenedor.querySelectorAll('.boton-aumentar-carrito').forEach(boton => {
    boton.addEventListener('click', () => {
      const indice = Number(boton.dataset.indice);
      estadoApp.carritoItems[indice].cantidad++;
      recalcularPrecioArticulo(indice);
      renderizarArticulosCarrito();
      recalcularTotales();
      actualizarContadorCarrito();
    });
  });

  contenedor.querySelectorAll('.boton-eliminar').forEach(boton => {
    boton.addEventListener('click', () => {
      estadoApp.carritoItems.splice(Number(boton.dataset.indice), 1);
      renderizarArticulosCarrito();
      recalcularTotales();
      actualizarContadorCarrito();
    });
  });
}

function recalcularPrecioArticulo(indice) {
  const item          = estadoApp.carritoItems[indice];
  const totalBebidas  = item.bebidasSeleccionadas.reduce(
    (suma, b) => suma + Number(b.bebida.precio) * b.cantidad, 0
  );
  item.precioTotal = Number(item.plato.precio) * item.cantidad + totalBebidas;
}

function recalcularTotales() {
  const subtotal      = estadoApp.carritoItems.reduce((suma, item) => suma + item.precioTotal, 0);
  const costoDelivery = estadoApp.esDelivery ? COSTO_DELIVERY : 0;

  obtenerElemento('valorSubtotal').textContent  = formatearPrecio(subtotal);
  obtenerElemento('valorDelivery').textContent  = formatearPrecio(costoDelivery);
  obtenerElemento('valorTotalPagar').textContent= formatearPrecio(subtotal + costoDelivery);
  obtenerElemento('filaDelivery').style.display = estadoApp.esDelivery ? 'flex' : 'none';
}

// Cambio tipo de entrega
document.querySelectorAll('input[name="tipoEntrega"]').forEach(radio => {
  radio.addEventListener('change', () => {
    estadoApp.esDelivery = radio.value === 'delivery';
    alternarVisibilidad(obtenerElemento('infoLocalDireccion'), !estadoApp.esDelivery);
    alternarVisibilidad(obtenerElemento('camposDelivery'), estadoApp.esDelivery);
    recalcularTotales();
  });
});

/* ─── UBIGEO PARA DELIVERY ───────────────────────── */
async function cargarDepartamentos() {
  try {
    const respuesta = await llamarAPI(RUTAS_API.pedidos, { accion: 'ubigeo', tipo: 'departamentos' });
    const selectDep = obtenerElemento('selectDepartamento');
    selectDep.innerHTML = '<option value="">Selecciona departamento...</option>' +
      respuesta.datos.map(dep => `<option value="${dep.id}">${dep.nombre}</option>`).join('');
  } catch (error) {
    console.error('Error cargando departamentos:', error.message);
  }
}

obtenerElemento('selectDepartamento').addEventListener('change', async function () {
  const idDepartamento = Number(this.value);
  estadoApp.idDepartamentoSeleccionado = idDepartamento || null;

  const selectProvincia = obtenerElemento('selectProvincia');
  const selectDistrito  = obtenerElemento('selectDistrito');

  selectProvincia.innerHTML = '<option value="">Selecciona provincia...</option>';
  selectDistrito.innerHTML  = '<option value="">Selecciona distrito...</option>';
  selectProvincia.disabled  = true;
  selectDistrito.disabled   = true;

  if (!idDepartamento) return;

  try {
    const respuesta = await llamarAPI(RUTAS_API.pedidos, {
      accion:    'ubigeo',
      tipo:      'provincias',
      id_padre:  idDepartamento,
    });
    selectProvincia.innerHTML = '<option value="">Selecciona provincia...</option>' +
      respuesta.datos.map(prov => `<option value="${prov.id}">${prov.nombre}</option>`).join('');
    selectProvincia.disabled = false;
  } catch (error) {
    mostrarNotificacion('Error al cargar provincias');
  }
});

obtenerElemento('selectProvincia').addEventListener('change', async function () {
  const idProvincia = Number(this.value);
  estadoApp.idProvinciaSeleccionada = idProvincia || null;

  const selectDistrito = obtenerElemento('selectDistrito');
  selectDistrito.innerHTML = '<option value="">Selecciona distrito...</option>';
  selectDistrito.disabled  = true;

  if (!idProvincia) return;

  try {
    const respuesta = await llamarAPI(RUTAS_API.pedidos, {
      accion:   'ubigeo',
      tipo:     'distritos',
      id_padre: idProvincia,
    });
    selectDistrito.innerHTML = '<option value="">Selecciona distrito...</option>' +
      respuesta.datos.map(dist => `<option value="${dist.id}">${dist.nombre}</option>`).join('');
    selectDistrito.disabled = false;
  } catch (error) {
    mostrarNotificacion('Error al cargar distritos');
  }
});

obtenerElemento('selectDistrito').addEventListener('change', function () {
  estadoApp.idDistritoSeleccionado = Number(this.value) || null;
});

// Ir a pagar
obtenerElemento('botonPagarAhora').addEventListener('click', () => {
  if (!estadoApp.carritoItems.length) {
    mostrarNotificacion('Tu carrito esta vacio');
    return;
  }
  if (estadoApp.esDelivery) {
    if (!estadoApp.idDepartamentoSeleccionado ||
        !estadoApp.idProvinciaSeleccionada    ||
        !estadoApp.idDistritoSeleccionado) {
      mostrarNotificacion('Selecciona departamento, provincia y distrito para el delivery');
      return;
    }
    if (!obtenerElemento('campodireccionEntrega').value.trim()) {
      mostrarNotificacion('Ingresa la direccion de entrega');
      return;
    }
  }
  ocultarElemento('modalCarrito');
  estadoApp.usuarioSesion ? mostrarElemento('modalPago') : mostrarElemento('modalAutenticacion');
});

/* ─── AUTENTICACION ──────────────────────────────── */
obtenerElemento('cerrarModalAutenticacion').addEventListener('click', () => ocultarElemento('modalAutenticacion'));
obtenerElemento('modalAutenticacion').addEventListener('click', evento => {
  if (evento.target === obtenerElemento('modalAutenticacion')) ocultarElemento('modalAutenticacion');
});

async function procesarLoginOAuth(nombreProveedor) {
  try {
    const respuesta = await llamarAPI(RUTAS_API.autenticacion, { accion: 'oauth' }, 'POST', {
      proveedor: nombreProveedor,
      nombre:    'Usuario ' + nombreProveedor,
      correo:    `usuario.${nombreProveedor}@demo.com`,
    });
    estadoApp.usuarioSesion = respuesta.usuario;
    ocultarElemento('modalAutenticacion');
    mostrarElemento('modalPago');
    mostrarNotificacion(`Bienvenido, ${respuesta.usuario.nombre_completo}`);
  } catch (error) {
    mostrarNotificacion('Error: ' + error.message);
  }
}

obtenerElemento('botonLoginGoogle').addEventListener('click',   () => procesarLoginOAuth('google'));
obtenerElemento('botonLoginFacebook').addEventListener('click', () => procesarLoginOAuth('facebook'));

obtenerElemento('botonYaTengoCuenta').addEventListener('click', () => {
  alternarVisibilidad(
    obtenerElemento('formularioInicioSesion'),
    obtenerElemento('formularioInicioSesion').classList.contains('oculto')
  );
});

obtenerElemento('botonConfirmarLogin').addEventListener('click', async () => {
  const correo    = obtenerElemento('campoCorreoLogin').value.trim();
  const contrasena = obtenerElemento('campoContrasenaLogin').value.trim();
  if (!correo || !contrasena) { mostrarNotificacion('Ingresa correo y contrasena'); return; }

  try {
    const respuesta = await llamarAPI(RUTAS_API.autenticacion, { accion: 'iniciar_sesion' }, 'POST', { correo, contrasena });
    estadoApp.usuarioSesion = respuesta.usuario;
    ocultarElemento('modalAutenticacion');
    mostrarElemento('modalPago');
    mostrarNotificacion(`Bienvenido, ${respuesta.usuario.nombre_completo}`);
  } catch (error) {
    mostrarNotificacion('Error: ' + error.message);
  }
});

obtenerElemento('enlaceCrearCuenta').addEventListener('click', async evento => {
  evento.preventDefault();
  const nombreNuevo    = prompt('Tu nombre completo:');
  const correoNuevo    = prompt('Tu correo electronico:');
  const contrasenaNueva= prompt('Crea una contrasena:');
  if (!nombreNuevo || !correoNuevo || !contrasenaNueva) return;
  try {
    const respuesta = await llamarAPI(RUTAS_API.autenticacion, { accion: 'registrarse' }, 'POST', {
      nombre: nombreNuevo, correo: correoNuevo, contrasena: contrasenaNueva,
    });
    mostrarNotificacion(respuesta.mensaje + '. Ahora inicia sesion.');
    mostrarElemento(obtenerElemento('formularioInicioSesion'));
  } catch (error) {
    mostrarNotificacion('Error: ' + error.message);
  }
});

obtenerElemento('enlaceRecuperarContrasena').addEventListener('click', evento => {
  evento.preventDefault();
  mostrarNotificacion('Recuperacion de contrasena: proximamente disponible');
});

/* ─── PROCESO DE PAGO ────────────────────────────── */
obtenerElemento('cerrarModalPago').addEventListener('click', () => ocultarElemento('modalPago'));

obtenerElemento('botonVolverAlMenu').addEventListener('click', () => {
  ocultarElemento('modalPago');
  estadoApp.carritoItems = [];
  actualizarContadorCarrito();
  mostrarNotificacion('Volviendo al menu...');
});

obtenerElemento('botonRealizarPago').addEventListener('click', async () => {
  const metodoPagoSeleccionado      = document.querySelector('input[name="metodoPago"]:checked');
  const tipoComprobanteSeleccionado = document.querySelector('input[name="tipoComprobante"]:checked');

  if (!metodoPagoSeleccionado)      { mostrarNotificacion('Selecciona un metodo de pago'); return; }
  if (!tipoComprobanteSeleccionado) { mostrarNotificacion('Selecciona el tipo de comprobante'); return; }

  // Construir articulos del pedido para la API
  const articulosParaEnviar = estadoApp.carritoItems.map(item => ({
    plato_id:    item.plato.id,
    cantidad:    item.cantidad,
    observacion: item.especificaciones,
    bebidas:     item.bebidasSeleccionadas.map(b => ({
      bebida_id: b.bebida.id,
      cantidad:  b.cantidad,
    })),
  }));

  const cuerpoSolicitud = {
    usuario_id:         estadoApp.usuarioSesion?.id ?? null,
    tipo_entrega:       estadoApp.esDelivery ? 'delivery' : 'local',
    departamento_id:    estadoApp.idDepartamentoSeleccionado ?? null,
    provincia_id:       estadoApp.idProvinciaSeleccionada    ?? null,
    distrito_id:        estadoApp.idDistritoSeleccionado     ?? null,
    direccion_entrega:  obtenerElemento('campodireccionEntrega')?.value.trim() ?? null,
    referencia_lugar:   obtenerElemento('campoReferenciaLugar')?.value.trim()  ?? null,
    metodo_pago:        metodoPagoSeleccionado.value,
    tipo_comprobante:   tipoComprobanteSeleccionado.value,
    articulos:          articulosParaEnviar,
  };

  try {
    const botonPagar = obtenerElemento('botonRealizarPago');
    botonPagar.disabled    = true;
    botonPagar.textContent = 'Procesando...';

    await llamarAPI(RUTAS_API.pedidos, { accion: 'crear' }, 'POST', cuerpoSolicitud);
    ocultarElemento('modalPago');
    mostrarElemento('modalPagoExitoso');
  } catch (error) {
    mostrarNotificacion('Error: ' + error.message);
  } finally {
    const botonPagar = obtenerElemento('botonRealizarPago');
    botonPagar.disabled    = false;
    botonPagar.textContent = 'Realizar Pago';
  }
});

obtenerElemento('botonAceptarPago').addEventListener('click', () => {
  ocultarElemento('modalPagoExitoso');
  estadoApp.carritoItems  = [];
  estadoApp.usuarioSesion = null;
  actualizarContadorCarrito();
  mostrarNotificacion('Gracias por tu pedido en El Abalon!');
});

/* ─── NAVEGACION ENTRE SECCIONES ────────────────── */
document.querySelectorAll('.boton-pestana').forEach(boton => {
  boton.addEventListener('click', () => {
    document.querySelectorAll('.boton-pestana').forEach(b => b.classList.remove('activo'));
    boton.classList.add('activo');
    const seccionDestino = boton.dataset.seccion;
    alternarVisibilidad(obtenerElemento('seccionMenu'),     seccionDestino === 'menu');
    alternarVisibilidad(obtenerElemento('seccionReservas'), seccionDestino === 'reservas');
  });
});

/* ─── MODULO DE RESERVAS ─────────────────────────── */
obtenerElemento('botonAbrirReserva').addEventListener('click', () => {
  estadoApp.datosReserva  = { fechaSeleccionada: null, horaSeleccionada: null, idMesaSeleccionada: null };
  estadoApp.horariosActuales = [];
  inicializarCalendario();
  mostrarElemento('modalReservasPaso1');
});

obtenerElemento('cerrarReservasPaso1').addEventListener('click', () => ocultarElemento('modalReservasPaso1'));
obtenerElemento('modalReservasPaso1').addEventListener('click', evento => {
  if (evento.target === obtenerElemento('modalReservasPaso1')) ocultarElemento('modalReservasPaso1');
});

// Nombres de días y meses en español
const NOMBRES_DIAS_SEMANA = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
const NOMBRES_MESES       = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

function inicializarCalendario() {
  estadoApp.fechaCalendario = new Date();
  obtenerElemento('etiquetaFechaSeleccionada').textContent = 'Ningun dia seleccionado';
  obtenerElemento('botonContinuarReserva').disabled = true;
  renderizarCalendario();
  obtenerElemento('contenedorHorarios').innerHTML =
    '<div class="mensaje-cargando">Selecciona una fecha para ver los horarios disponibles</div>';
}

function renderizarCalendario() {
  const anio       = estadoApp.fechaCalendario.getFullYear();
  const mes        = estadoApp.fechaCalendario.getMonth();
  obtenerElemento('etiquetaMesAnio').textContent = `${NOMBRES_MESES[mes]} ${anio}`;

  const primerDiaMes    = new Date(anio, mes, 1).getDay();
  const diasEnElMes     = new Date(anio, mes + 1, 0).getDate();
  const hoy             = new Date(); hoy.setHours(0,0,0,0);

  // Cabeceras de días de la semana
  let htmlCalendario = NOMBRES_DIAS_SEMANA
    .map(dia => `<div class="dia-semana-cabecera">${dia}</div>`)
    .join('');

  // Celdas vacías al inicio
  for (let i = 0; i < primerDiaMes; i++) {
    htmlCalendario += `<div class="celda-dia celda-dia--vacio"></div>`;
  }

  // Celdas de días del mes
  for (let dia = 1; dia <= diasEnElMes; dia++) {
    const fechaCelda    = new Date(anio, mes, dia);
    const cadenaFecha   = fechaCelda.toISOString().split('T')[0];
    const esPasado      = fechaCelda < hoy;
    const esHoy         = fechaCelda.getTime() === hoy.getTime();
    const estaSeleccionado = estadoApp.datosReserva.fechaSeleccionada === cadenaFecha;

    let clasesCSS = 'celda-dia';
    if (esPasado)          clasesCSS += ' celda-dia--deshabilitado';
    if (esHoy)             clasesCSS += ' celda-dia--hoy';
    if (estaSeleccionado)  clasesCSS += ' celda-dia--seleccionado';

    htmlCalendario += `<div class="${clasesCSS}" data-fecha="${cadenaFecha}">${dia}</div>`;
  }

  obtenerElemento('grillaCalendario').innerHTML = htmlCalendario;

  // Eventos en celdas habilitadas
  obtenerElemento('grillaCalendario')
    .querySelectorAll('.celda-dia:not(.celda-dia--deshabilitado):not(.celda-dia--vacio)')
    .forEach(celda => {
      celda.addEventListener('click', async () => {
        estadoApp.datosReserva.fechaSeleccionada = celda.dataset.fecha;
        estadoApp.datosReserva.horaSeleccionada  = null;
        obtenerElemento('etiquetaFechaSeleccionada').textContent =
          `Fecha: ${formatearFecha(estadoApp.datosReserva.fechaSeleccionada)}`;
        renderizarCalendario();
        await cargarHorariosDisponibles(estadoApp.datosReserva.fechaSeleccionada);
        verificarSiPuedeContinuar();
      });
    });
}

async function cargarHorariosDisponibles(fecha) {
  obtenerElemento('contenedorHorarios').innerHTML =
    '<div class="mensaje-cargando">Verificando disponibilidad de horarios...</div>';
  try {
    const respuesta = await llamarAPI(RUTAS_API.reservas, { accion: 'disponibilidad', fecha });
    estadoApp.horariosActuales = respuesta.datos;
    renderizarPastillasHorario(respuesta.datos);
  } catch (error) {
    obtenerElemento('contenedorHorarios').innerHTML =
      `<div class="mensaje-error">${error.message}</div>`;
  }
}

function renderizarPastillasHorario(listaHorarios) {
  const contenedor = obtenerElemento('contenedorHorarios');

  const leyendaHTML = `
    <div class="leyenda-disponibilidad">
      <div class="leyenda-item"><div class="leyenda-punto leyenda-punto--rojo"></div> Reservado</div>
      <div class="leyenda-item"><div class="leyenda-punto leyenda-punto--azul"></div> En consumo</div>
      <div class="leyenda-item"><div class="leyenda-punto leyenda-punto--verde"></div> Disponible</div>
    </div>`;

  const horariosHTML = listaHorarios.map(franja => {
    let clasesCSS = 'pastilla-horario';
    if (franja.estado === 'reservado')   clasesCSS += ' pastilla-horario--reservado';
    else if (franja.estado === 'activa') clasesCSS += ' pastilla-horario--activo';
    if (estadoApp.datosReserva.horaSeleccionada === franja.hora) {
      clasesCSS += ' pastilla-horario--seleccionado';
    }

    const estaOcupado = franja.estado !== 'disponible';
    return `<div class="${clasesCSS}"
                 data-hora="${franja.hora}"
                 ${estaOcupado ? 'data-ocupado="true"' : ''}>${franja.hora}</div>`;
  }).join('');

  contenedor.innerHTML = leyendaHTML + horariosHTML;

  contenedor.querySelectorAll('.pastilla-horario:not([data-ocupado])').forEach(pastilla => {
    pastilla.addEventListener('click', () => {
      estadoApp.datosReserva.horaSeleccionada = pastilla.dataset.hora;
      renderizarPastillasHorario(listaHorarios);
      verificarSiPuedeContinuar();
    });
  });
}

function verificarSiPuedeContinuar() {
  const botonContinuar = obtenerElemento('botonContinuarReserva');
  botonContinuar.disabled = !(
    estadoApp.datosReserva.fechaSeleccionada &&
    estadoApp.datosReserva.horaSeleccionada
  );
}

function formatearFecha(cadenaFecha) {
  if (!cadenaFecha) return '';
  const [anio, mes, dia] = cadenaFecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

obtenerElemento('mesAnterior').addEventListener('click', () => {
  estadoApp.fechaCalendario.setMonth(estadoApp.fechaCalendario.getMonth() - 1);
  renderizarCalendario();
});

obtenerElemento('mesSiguiente').addEventListener('click', () => {
  estadoApp.fechaCalendario.setMonth(estadoApp.fechaCalendario.getMonth() + 1);
  renderizarCalendario();
});

obtenerElemento('botonContinuarReserva').addEventListener('click', () => {
  ocultarElemento('modalReservasPaso1');
  abrirPaso2Reserva();
});

/* ─── RESERVAS PASO 2 ────────────────────────────── */
function abrirPaso2Reserva() {
  const ahora = new Date();
  obtenerElemento('resumenReserva').innerHTML = `
    Reserva para: <strong>${formatearFecha(estadoApp.datosReserva.fechaSeleccionada)}</strong>
    a las <strong>${estadoApp.datosReserva.horaSeleccionada}</strong> horas<br>
    Solicitada el: <strong>${formatearFecha(ahora.toISOString().split('T')[0])}</strong>
    a las <strong>${String(ahora.getHours()).padStart(2,'0')}:${String(ahora.getMinutes()).padStart(2,'0')}</strong> horas
  `;

  renderizarCroquisMesas();
  obtenerElemento('infoMesaSeleccionada').textContent = 'Ninguna mesa seleccionada';
  ['campoNombreTitular','campoCelularTitular','campoCorreoTitular',
   'campoMotivoReserva','campoSugerencias'].forEach(idCampo => {
    obtenerElemento(idCampo).value = '';
  });

  mostrarElemento('modalReservasPaso2');
}

function renderizarCroquisMesas() {
  const contenedorMapa = obtenerElemento('mapaRestaurante');
  contenedorMapa.innerHTML = '';

  estadoApp.listaMesas.forEach(mesa => {
    const divMesa = document.createElement('div');
    divMesa.className = 'mesa-del-mapa' +
      (estadoApp.datosReserva.idMesaSeleccionada === mesa.id ? ' mesa-del-mapa--seleccionada' : '');

    divMesa.innerHTML = `
      <span style="font-size:1.4rem">&#9632;</span>
      <span class="mesa-numero">Mesa ${mesa.numero_mesa}</span>
    `;

    divMesa.addEventListener('click', () => {
      estadoApp.datosReserva.idMesaSeleccionada = mesa.id;
      obtenerElemento('infoMesaSeleccionada').textContent =
        `Mesa ${mesa.numero_mesa} seleccionada — Capacidad: ${mesa.capacidad} personas`;
      renderizarCroquisMesas();
    });

    contenedorMapa.appendChild(divMesa);
  });
}

obtenerElemento('cerrarReservasPaso2').addEventListener('click', () => ocultarElemento('modalReservasPaso2'));
obtenerElemento('modalReservasPaso2').addEventListener('click', evento => {
  if (evento.target === obtenerElemento('modalReservasPaso2')) ocultarElemento('modalReservasPaso2');
});

obtenerElemento('botonConfirmarReserva').addEventListener('click', async () => {
  const nombreTitular  = obtenerElemento('campoNombreTitular').value.trim();
  const celularTitular = obtenerElemento('campoCelularTitular').value.trim();
  const correoTitular  = obtenerElemento('campoCorreoTitular').value.trim();

  if (!nombreTitular || !celularTitular || !correoTitular) {
    mostrarNotificacion('Completa nombre, celular y correo del titular');
    return;
  }
  if (!estadoApp.datosReserva.idMesaSeleccionada) {
    mostrarNotificacion('Selecciona una mesa del croquis');
    return;
  }

  const mesaElegida = estadoApp.listaMesas.find(m => m.id === estadoApp.datosReserva.idMesaSeleccionada);

  try {
    const botonReservar = obtenerElemento('botonConfirmarReserva');
    botonReservar.disabled    = true;
    botonReservar.textContent = 'Guardando reserva...';

    await llamarAPI(RUTAS_API.reservas, { accion: 'crear' }, 'POST', {
      mesa_id:     estadoApp.datosReserva.idMesaSeleccionada,
      nombre:      nombreTitular,
      celular:     celularTitular,
      correo:      correoTitular,
      fecha:       estadoApp.datosReserva.fechaSeleccionada,
      hora:        estadoApp.datosReserva.horaSeleccionada,
      motivo:      obtenerElemento('campoMotivoReserva').value.trim() || null,
      sugerencias: obtenerElemento('campoSugerencias').value.trim()   || null,
    });

    ocultarElemento('modalReservasPaso2');
    obtenerElemento('textoReservaExitosa').textContent =
      `${nombreTitular} — ${formatearFecha(estadoApp.datosReserva.fechaSeleccionada)} ` +
      `a las ${estadoApp.datosReserva.horaSeleccionada} — Mesa ${mesaElegida?.numero_mesa}`;
    mostrarElemento('modalReservaExitosa');

  } catch (error) {
    mostrarNotificacion('Error: ' + error.message);
  } finally {
    const botonReservar = obtenerElemento('botonConfirmarReserva');
    botonReservar.disabled    = false;
    botonReservar.textContent = 'Reservar';
  }
});

obtenerElemento('botonAceptarReserva').addEventListener('click', () => {
  ocultarElemento('modalReservaExitosa');
  estadoApp.datosReserva = { fechaSeleccionada: null, horaSeleccionada: null, idMesaSeleccionada: null };
  mostrarNotificacion('Reserva guardada con exito. Hasta pronto!');
});

/* ARRANCAR LA APLICACION  */
inicializarAplicacion();
