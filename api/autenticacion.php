<?php
// ══════════════════════════════════════════════════════
//  api/autenticacion.php — Login y registro de usuarios
//
//  POST ?accion=iniciar_sesion  → correo + contraseña
//  POST ?accion=registrarse     → nombre, correo, contraseña, telefono
//  POST ?accion=oauth           → proveedor + nombre + correo
// ══════════════════════════════════════════════════════
require_once __DIR__ . '/configuracion.php';

$accionSolicitada = $_GET['accion'] ?? '';

switch ($accionSolicitada) {

    // ── Iniciar sesión con correo y contraseña ───────
    case 'iniciar_sesion':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            responderJSON(['correcto' => false, 'mensaje' => 'Método no permitido'], 405);
        }

        $datosRecibidos = leerCuerpoJSON();

        if (empty($datosRecibidos['correo']) || empty($datosRecibidos['contrasena'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'Correo y contraseña son obligatorios'], 400);
        }

        $consultaUsuario = obtenerConexion()->prepare(
            "SELECT id, nombre_completo, correo_electronico, contrasena, numero_telefono
             FROM usuarios
             WHERE correo_electronico = ?
               AND proveedor_login = 'local'
             LIMIT 1"
        );
        $consultaUsuario->execute([strtolower(trim($datosRecibidos['correo']))]);
        $usuarioEncontrado = $consultaUsuario->fetch();

        if (!$usuarioEncontrado || !password_verify($datosRecibidos['contrasena'], $usuarioEncontrado['contrasena'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'Correo o contraseña incorrectos'], 401);
        }

        // No devolver la contraseña al frontend
        unset($usuarioEncontrado['contrasena']);
        responderJSON(['correcto' => true, 'usuario' => $usuarioEncontrado]);
        break;

    // ── Registrar nuevo usuario ──────────────────────
    case 'registrarse':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            responderJSON(['correcto' => false, 'mensaje' => 'Método no permitido'], 405);
        }

        $datosRecibidos = leerCuerpoJSON();

        if (empty($datosRecibidos['nombre']) || empty($datosRecibidos['correo']) || empty($datosRecibidos['contrasena'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'Nombre, correo y contraseña son obligatorios'], 400);
        }

        $conexion = obtenerConexion();

        // Verificar que el correo no esté ya registrado
        $verificarCorreo = $conexion->prepare(
            "SELECT id FROM usuarios WHERE correo_electronico = ? LIMIT 1"
        );
        $verificarCorreo->execute([strtolower(trim($datosRecibidos['correo']))]);
        if ($verificarCorreo->fetch()) {
            responderJSON(['correcto' => false, 'mensaje' => 'Ese correo ya está registrado'], 409);
        }

        $contrasenaEncriptada = password_hash($datosRecibidos['contrasena'], PASSWORD_BCRYPT);

        $insertarUsuario = $conexion->prepare(
            "INSERT INTO usuarios (nombre_completo, correo_electronico, contrasena, numero_telefono, proveedor_login)
             VALUES (?, ?, ?, ?, 'local')"
        );
        $insertarUsuario->execute([
            trim($datosRecibidos['nombre']),
            strtolower(trim($datosRecibidos['correo'])),
            $contrasenaEncriptada,
            $datosRecibidos['telefono'] ?? null,
        ]);

        responderJSON([
            'correcto'  => true,
            'id'        => (int)$conexion->lastInsertId(),
            'nombre'    => trim($datosRecibidos['nombre']),
            'correo'    => strtolower(trim($datosRecibidos['correo'])),
            'mensaje'   => 'Cuenta creada exitosamente',
        ], 201);
        break;

    // ── Login por red social (Google / Facebook) ─────
    case 'oauth':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            responderJSON(['correcto' => false, 'mensaje' => 'Método no permitido'], 405);
        }

        $datosRecibidos = leerCuerpoJSON();

        if (empty($datosRecibidos['correo']) || empty($datosRecibidos['nombre']) || empty($datosRecibidos['proveedor'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'Datos de inicio de sesión social incompletos'], 400);
        }
        if (!in_array($datosRecibidos['proveedor'], ['google', 'facebook'])) {
            responderJSON(['correcto' => false, 'mensaje' => 'Proveedor no válido'], 400);
        }

        $conexion       = obtenerConexion();
        $correoLimpio   = strtolower(trim($datosRecibidos['correo']));

        // Buscar si el usuario ya existe
        $buscarUsuario = $conexion->prepare(
            "SELECT id, nombre_completo, correo_electronico FROM usuarios
             WHERE correo_electronico = ? LIMIT 1"
        );
        $buscarUsuario->execute([$correoLimpio]);
        $usuarioExistente = $buscarUsuario->fetch();

        if (!$usuarioExistente) {
            // Crear el usuario automáticamente
            $crearUsuario = $conexion->prepare(
                "INSERT INTO usuarios (nombre_completo, correo_electronico, proveedor_login)
                 VALUES (?, ?, ?)"
            );
            $crearUsuario->execute([trim($datosRecibidos['nombre']), $correoLimpio, $datosRecibidos['proveedor']]);
            $usuarioExistente = [
                'id'                => (int)$conexion->lastInsertId(),
                'nombre_completo'   => trim($datosRecibidos['nombre']),
                'correo_electronico'=> $correoLimpio,
            ];
        }

        responderJSON(['correcto' => true, 'usuario' => $usuarioExistente]);
        break;

    default:
        responderJSON(['correcto' => false, 'mensaje' => 'Acción no reconocida'], 400);
}
