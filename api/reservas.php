<?php
// ══════════════════════════════════════════════════════
//  api/reservas.php — Endpoints de reservas
//
//  GET  ?accion=mesas                           → lista de mesas
//  GET  ?accion=disponibilidad&fecha=YYYY-MM-DD → horarios por fecha
//  POST ?accion=crear                           → crear nueva reserva
// ══════════════════════════════════════════════════════
require_once __DIR__ . '/configuracion.php';

$accionSolicitada = $_GET['accion'] ?? '';

switch ($accionSolicitada) {

    // ── Listar mesas del local ───────────────────────
    case 'mesas':
        $consulta = obtenerConexion()->query(
            "SELECT id, numero_mesa, capacidad
             FROM mesas
             WHERE esta_activo = 1
             ORDER BY numero_mesa ASC"
        );
        responderJSON(['correcto' => true, 'datos' => $consulta->fetchAll()]);
        break;

    // ── Consultar disponibilidad de horarios ─────────
    case 'disponibilidad':
        $fechaConsultada = $_GET['fecha'] ?? '';
        if (!$fechaConsultada || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaConsultada)) {
            responderJSON(['correcto' => false, 'mensaje' => 'Fecha inválida. Formato esperado: YYYY-MM-DD'], 400);
        }

        // Buscar reservas existentes en esa fecha
        $consultaReservas = obtenerConexion()->prepare(
            "SELECT TIME_FORMAT(hora_reserva, '%H:%i') AS hora, estado_reserva
             FROM reservas
             WHERE fecha_reserva = ?
               AND estado_reserva NOT IN ('cancelada', 'finalizada')"
        );
        $consultaReservas->execute([$fechaConsultada]);
        $reservasExistentes = $consultaReservas->fetchAll();

        // Indexar por hora para búsqueda rápida
        $horasOcupadas = [];
        foreach ($reservasExistentes as $reserva) {
            $horasOcupadas[$reserva['hora']] = $reserva['estado_reserva'];
        }

        // Generar franjas horarias de 08:00 a 20:00
        $franjasHorarias = [];
        for ($hora = 8; $hora <= 20; $hora++) {
            $horaFormateada = str_pad($hora, 2, '0', STR_PAD_LEFT) . ':00';
            $estadoFranja   = 'disponible';

            if (isset($horasOcupadas[$horaFormateada])) {
                $estadoFranja = ($horasOcupadas[$horaFormateada] === 'activa')
                    ? 'activa'
                    : 'reservado';
            }

            $franjasHorarias[] = [
                'hora'   => $horaFormateada,
                'estado' => $estadoFranja,
            ];
        }

        responderJSON([
            'correcto' => true,
            'fecha'    => $fechaConsultada,
            'datos'    => $franjasHorarias,
        ]);
        break;

    // ── Crear nueva reserva ──────────────────────────
    case 'crear':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            responderJSON(['correcto' => false, 'mensaje' => 'Método no permitido'], 405);
        }

        $datosRecibidos = leerCuerpoJSON();

        // Validar campos obligatorios
        $camposObligatorios = ['mesa_id', 'nombre', 'celular', 'correo', 'fecha', 'hora'];
        foreach ($camposObligatorios as $campo) {
            if (empty($datosRecibidos[$campo])) {
                responderJSON(['correcto' => false, 'mensaje' => "Campo obligatorio faltante: $campo"], 400);
            }
        }

        // La fecha debe ser posterior a hoy
        if ($datosRecibidos['fecha'] <= date('Y-m-d')) {
            responderJSON(['correcto' => false, 'mensaje' => 'La fecha de reserva debe ser posterior a hoy'], 400);
        }

        // La hora debe estar en rango 08:00 – 20:00
        $horaEntera = (int)substr($datosRecibidos['hora'], 0, 2);
        if ($horaEntera < 8 || $horaEntera > 20) {
            responderJSON(['correcto' => false, 'mensaje' => 'El horario debe estar entre 08:00 y 20:00'], 400);
        }

        // Verificar que la hora no esté ya ocupada
        $conexion         = obtenerConexion();
        $verificarHora    = $conexion->prepare(
            "SELECT COUNT(*) FROM reservas
             WHERE fecha_reserva = ?
               AND hora_reserva  = ?
               AND estado_reserva NOT IN ('cancelada', 'finalizada')"
        );
        $verificarHora->execute([$datosRecibidos['fecha'], $datosRecibidos['hora'] . ':00']);

        if ($verificarHora->fetchColumn() > 0) {
            responderJSON(['correcto' => false, 'mensaje' => 'Esa hora ya está reservada, elige otra'], 409);
        }

        // Insertar la nueva reserva
        $insertar = $conexion->prepare(
            "INSERT INTO reservas
             (mesa_id, nombre_titular, numero_celular, correo_titular,
              fecha_reserva, hora_reserva, motivo, sugerencias, estado_reserva)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmada')"
        );
        $insertar->execute([
            (int)$datosRecibidos['mesa_id'],
            trim($datosRecibidos['nombre']),
            trim($datosRecibidos['celular']),
            trim($datosRecibidos['correo']),
            $datosRecibidos['fecha'],
            $datosRecibidos['hora'] . ':00',
            $datosRecibidos['motivo']      ?? null,
            $datosRecibidos['sugerencias'] ?? null,
        ]);

        responderJSON([
            'correcto'     => true,
            'id_reserva'   => (int)$conexion->lastInsertId(),
            'mensaje'      => 'Reserva confirmada correctamente',
        ], 201);
        break;

    default:
        responderJSON(['correcto' => false, 'mensaje' => 'Acción no reconocida'], 400);
}
