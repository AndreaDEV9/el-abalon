<?php
// ══════════════════════════════════════════════════════
//  api/menu.php — Endpoints del menú
//
//  GET ?accion=categorias            → lista de categorías activas
//  GET ?accion=platos                → todos los platos disponibles
//  GET ?accion=platos&categoria=ID   → platos de una categoría
//  GET ?accion=plato&id=ID           → detalle de un plato
//  GET ?accion=bebidas               → lista de bebidas disponibles
// ══════════════════════════════════════════════════════
require_once __DIR__ . '/configuracion.php';

$accionSolicitada = $_GET['accion'] ?? '';

switch ($accionSolicitada) {

    // ── Listar categorías activas ────────────────────
    case 'categorias':
        $consulta = obtenerConexion()->query(
            "SELECT id, nombre, descripcion, orden_visual
             FROM categorias
             WHERE esta_activo = 1
             ORDER BY orden_visual ASC"
        );
        responderJSON(['correcto' => true, 'datos' => $consulta->fetchAll()]);
        break;

    // ── Listar platos (todos o por categoría) ────────
    case 'platos':
        $conexion    = obtenerConexion();
        $idCategoria = isset($_GET['categoria']) ? (int)$_GET['categoria'] : null;

        if ($idCategoria) {
            $consulta = $conexion->prepare(
                "SELECT p.id, p.nombre, p.descripcion, p.precio, p.url_imagen,
                        c.nombre   AS nombre_categoria,
                        c.orden_visual AS orden_categoria
                 FROM platos p
                 JOIN categorias c ON c.id = p.categoria_id
                 WHERE p.esta_disponible = 1
                   AND p.categoria_id = ?
                 ORDER BY p.orden_visual ASC"
            );
            $consulta->execute([$idCategoria]);
        } else {
            $consulta = $conexion->query(
                "SELECT p.id, p.nombre, p.descripcion, p.precio, p.url_imagen,
                        c.id       AS id_categoria,
                        c.nombre   AS nombre_categoria
                 FROM platos p
                 JOIN categorias c ON c.id = p.categoria_id
                 WHERE p.esta_disponible = 1
                 ORDER BY c.orden_visual ASC, p.orden_visual ASC"
            );
        }
        responderJSON(['correcto' => true, 'datos' => $consulta->fetchAll()]);
        break;

    // ── Detalle de un plato ──────────────────────────
    case 'plato':
        $idPlato = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$idPlato) {
            responderJSON(['correcto' => false, 'mensaje' => 'ID de plato requerido'], 400);
        }

        $consulta = obtenerConexion()->prepare(
            "SELECT p.*, c.nombre AS nombre_categoria
             FROM platos p
             JOIN categorias c ON c.id = p.categoria_id
             WHERE p.id = ? AND p.esta_disponible = 1"
        );
        $consulta->execute([$idPlato]);
        $platoEncontrado = $consulta->fetch();

        if (!$platoEncontrado) {
            responderJSON(['correcto' => false, 'mensaje' => 'Plato no encontrado'], 404);
        }
        responderJSON(['correcto' => true, 'datos' => $platoEncontrado]);
        break;

    // ── Listar bebidas disponibles ───────────────────
    case 'bebidas':
        $consulta = obtenerConexion()->query(
            "SELECT id, nombre, tipo_bebida, precio
             FROM bebidas
             WHERE esta_disponible = 1
             ORDER BY tipo_bebida ASC, nombre ASC"
        );
        responderJSON(['correcto' => true, 'datos' => $consulta->fetchAll()]);
        break;

    default:
        responderJSON(['correcto' => false, 'mensaje' => 'Acción no reconocida'], 400);
}
