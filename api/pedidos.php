<?php
// ══════════════════════════════════════════════════════
//  api/pedidos.php — Endpoints de pedidos
//
//  POST ?accion=crear        → registrar un pedido completo
//  GET  ?accion=consultar&id= → consultar estado de un pedido
//  GET  ?accion=ubigeo        → obtener departamentos/provincias/distritos
// ══════════════════════════════════════════════════════
require_once __DIR__ . '/configuracion.php';

$accionSolicitada = $_GET['accion'] ?? '';

switch ($accionSolicitada) {

    // ── Obtener ubigeo para el formulario de delivery ─
    case 'ubigeo':
        $conexion    = obtenerConexion();
        $tipoDato    = $_GET['tipo'] ?? 'departamentos';
        $idPadre     = isset($_GET['id_padre']) ? (int)$_GET['id_padre'] : null;

        if ($tipoDato === 'departamentos') {
            $consulta = $conexion->query(
                "SELECT id, nombre FROM departamentos ORDER BY nombre ASC"
            );
            responderJSON(['correcto' => true, 'datos' => $consulta->fetchAll()]);

        } elseif ($tipoDato === 'provincias' && $idPadre) {
            $consulta = $conexion->prepare(
                "SELECT id, nombre FROM provincias
                 WHERE departamento_id = ?
                 ORDER BY nombre ASC"
            );
            $consulta->execute([$idPadre]);
            responderJSON(['correcto' => true, 'datos' => $consulta->fetchAll()]);

        } elseif ($tipoDato === 'distritos' && $idPadre) {
            $consulta = $conexion->prepare(
                "SELECT id, nombre FROM distritos
                 WHERE provincia_id = ?
                 ORDER BY nombre ASC"
            );
            $consulta->execute([$idPadre]);
            responderJSON(['correcto' => true, 'datos' => $consulta->fetchAll()]);

        } else {
            responderJSON(['correcto' => false, 'mensaje' => 'Parámetros de ubigeo inválidos'], 400);
        }
        break;

    // ── Crear nuevo pedido ───────────────────────────
    case 'crear':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            responderJSON(['correcto' => false, 'mensaje' => 'Método no permitido'], 405);
        }

        $datosRecibidos = leerCuerpoJSON();

        // Validaciones de campos obligatorios
        if (empty($datosRecibidos['articulos']) || !is_array($datosRecibidos['articulos'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'El pedido no contiene platos'], 400);
        }
        if (!in_array($datosRecibidos['tipo_entrega'] ?? '', ['local', 'delivery'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'Tipo de entrega inválido'], 400);
        }
        if (!in_array($datosRecibidos['metodo_pago'] ?? '', ['tarjeta', 'yape', 'efectivo'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'Método de pago inválido'], 400);
        }
        if (!in_array($datosRecibidos['tipo_comprobante'] ?? '', ['boleta', 'factura'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'Tipo de comprobante inválido'], 400);
        }
        if ($datosRecibidos['tipo_entrega'] === 'delivery') {
            if (empty($datosRecibidos['departamento_id']) ||
                empty($datosRecibidos['provincia_id'])    ||
                empty($datosRecibidos['distrito_id'])     ||
                empty($datosRecibidos['direccion_entrega'])) {
                responderJSON(['correcto' => false, 'mensaje' => 'Para delivery debes completar departamento, provincia, distrito y dirección'], 400);
            }
        }

        $conexion = obtenerConexion();
        $conexion->beginTransaction();

        try {
            $subtotalCalculado = 0.0;

            // Verificar cada plato y calcular subtotal con precios reales de BD
            foreach ($datosRecibidos['articulos'] as &$articulo) {
                $consultaPlato = $conexion->prepare(
                    "SELECT precio FROM platos WHERE id = ? AND esta_disponible = 1"
                );
                $consultaPlato->execute([(int)$articulo['plato_id']]);
                $platoEncontrado = $consultaPlato->fetch();

                if (!$platoEncontrado) {
                    throw new Exception("Plato con ID {$articulo['plato_id']} no disponible");
                }

                $articulo['precio_unitario'] = (float)$platoEncontrado['precio'];
                $articulo['cantidad']        = max(1, (int)($articulo['cantidad'] ?? 1));
                $subtotalCalculado          += $articulo['precio_unitario'] * $articulo['cantidad'];

                // Verificar bebidas del artículo
                if (!empty($articulo['bebidas']) && is_array($articulo['bebidas'])) {
                    foreach ($articulo['bebidas'] as &$bebidaArticulo) {
                        $consultaBebida = $conexion->prepare(
                            "SELECT precio FROM bebidas WHERE id = ? AND esta_disponible = 1"
                        );
                        $consultaBebida->execute([(int)$bebidaArticulo['bebida_id']]);
                        $bebidaEncontrada = $consultaBebida->fetch();

                        if (!$bebidaEncontrada) {
                            throw new Exception("Bebida con ID {$bebidaArticulo['bebida_id']} no disponible");
                        }

                        $bebidaArticulo['precio_unitario'] = (float)$bebidaEncontrada['precio'];
                        $bebidaArticulo['cantidad']        = max(1, (int)($bebidaArticulo['cantidad'] ?? 1));
                        $subtotalCalculado                += $bebidaArticulo['precio_unitario'] * $bebidaArticulo['cantidad'];
                    }
                    unset($bebidaArticulo);
                }
            }
            unset($articulo);

            $costoDelivery   = ($datosRecibidos['tipo_entrega'] === 'delivery') ? COSTO_DELIVERY : 0.0;
            $totalAPagar     = $subtotalCalculado + $costoDelivery;

            // Insertar cabecera del pedido
            $insertarPedido = $conexion->prepare(
                "INSERT INTO pedidos
                 (usuario_id, tipo_entrega, departamento_id, provincia_id, distrito_id,
                  direccion_entrega, referencia_lugar, subtotal, costo_delivery,
                  total_pagar, metodo_pago, tipo_comprobante, observaciones)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
            );
            $insertarPedido->execute([
                $datosRecibidos['usuario_id']        ?? null,
                $datosRecibidos['tipo_entrega'],
                $datosRecibidos['departamento_id']   ?? null,
                $datosRecibidos['provincia_id']      ?? null,
                $datosRecibidos['distrito_id']       ?? null,
                $datosRecibidos['direccion_entrega'] ?? null,
                $datosRecibidos['referencia_lugar']  ?? null,
                round($subtotalCalculado, 2),
                round($costoDelivery, 2),
                round($totalAPagar, 2),
                $datosRecibidos['metodo_pago'],
                $datosRecibidos['tipo_comprobante'],
                $datosRecibidos['observaciones']     ?? null,
            ]);
            $idPedidoNuevo = (int)$conexion->lastInsertId();

            // Insertar platos del pedido y sus bebidas
            foreach ($datosRecibidos['articulos'] as $articulo) {
                $insertarPlato = $conexion->prepare(
                    "INSERT INTO detalle_pedido_platos
                     (pedido_id, plato_id, cantidad, precio_unitario, observacion)
                     VALUES (?,?,?,?,?)"
                );
                $insertarPlato->execute([
                    $idPedidoNuevo,
                    (int)$articulo['plato_id'],
                    $articulo['cantidad'],
                    $articulo['precio_unitario'],
                    $articulo['observacion'] ?? null,
                ]);
                $idDetallePlato = (int)$conexion->lastInsertId();

                if (!empty($articulo['bebidas'])) {
                    foreach ($articulo['bebidas'] as $bebidaArticulo) {
                        $insertarBebida = $conexion->prepare(
                            "INSERT INTO detalle_pedido_bebidas
                             (detalle_plato_id, bebida_id, cantidad, precio_unitario)
                             VALUES (?,?,?,?)"
                        );
                        $insertarBebida->execute([
                            $idDetallePlato,
                            (int)$bebidaArticulo['bebida_id'],
                            $bebidaArticulo['cantidad'],
                            $bebidaArticulo['precio_unitario'],
                        ]);
                    }
                }
            }

            $conexion->commit();

            responderJSON([
                'correcto'     => true,
                'id_pedido'    => $idPedidoNuevo,
                'subtotal'     => round($subtotalCalculado, 2),
                'delivery'     => round($costoDelivery, 2),
                'total_pagar'  => round($totalAPagar, 2),
                'mensaje'      => 'Pedido registrado correctamente',
            ], 201);

        } catch (Exception $errorTransaccion) {
            $conexion->rollBack();
            responderJSON(['correcto' => false, 'mensaje' => $errorTransaccion->getMessage()], 500);
        }
        break;

    // ── Consultar un pedido existente ────────────────
    case 'consultar':
        $idPedido = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$idPedido) {
            responderJSON(['correcto' => false, 'mensaje' => 'ID de pedido requerido'], 400);
        }

        $conexion       = obtenerConexion();
        $consultaPedido = $conexion->prepare("SELECT * FROM pedidos WHERE id = ?");
        $consultaPedido->execute([$idPedido]);
        $pedidoEncontrado = $consultaPedido->fetch();

        if (!$pedidoEncontrado) {
            responderJSON(['correcto' => false, 'mensaje' => 'Pedido no encontrado'], 404);
        }

        // Cargar platos del pedido
        $consultaDetallePlatos = $conexion->prepare(
            "SELECT dp.id, dp.cantidad, dp.precio_unitario, dp.observacion,
                    p.nombre AS nombre_plato
             FROM detalle_pedido_platos dp
             JOIN platos p ON p.id = dp.plato_id
             WHERE dp.pedido_id = ?"
        );
        $consultaDetallePlatos->execute([$idPedido]);
        $platosDelPedido = $consultaDetallePlatos->fetchAll();

        // Cargar bebidas de cada plato
        foreach ($platosDelPedido as &$detallePlato) {
            $consultaDetalleBebidas = $conexion->prepare(
                "SELECT db.cantidad, db.precio_unitario, b.nombre AS nombre_bebida
                 FROM detalle_pedido_bebidas db
                 JOIN bebidas b ON b.id = db.bebida_id
                 WHERE db.detalle_plato_id = ?"
            );
            $consultaDetalleBebidas->execute([$detallePlato['id']]);
            $detallePlato['bebidas'] = $consultaDetalleBebidas->fetchAll();
        }
        unset($detallePlato);

        $pedidoEncontrado['articulos'] = $platosDelPedido;
        responderJSON(['correcto' => true, 'datos' => $pedidoEncontrado]);
        break;

    default:
        responderJSON(['correcto' => false, 'mensaje' => 'Acción no reconocida'], 400);
}
