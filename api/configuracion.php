<?php
// ══════════════════════════════════════════════════════
//  configuracion.php
//  Ajusta los valores según tu instalación de XAMPP
// ══════════════════════════════════════════════════════

define('BD_SERVIDOR',  'localhost');
define('BD_USUARIO',   'root');        // usuario MySQL de XAMPP
define('BD_CONTRASENA','');            // contraseña MySQL (vacío en XAMPP)
define('BD_NOMBRE',    'el_abalon');
define('BD_PUERTO',    3306);

define('COSTO_DELIVERY',      5.00);
define('DIRECCION_LOCAL',     'Av. Huancavelica N.º 834, Chilca, Huancayo - Junin');
define('NOMBRE_RESTAURANTE',  'El Abalón – Restaurante Marisquería');

// ─── Conexión PDO ────────────────────────────────────
function obtenerConexion(): PDO {
    static $conexion = null;
    if ($conexion === null) {
        $cadenaConexion = "mysql:host=" . BD_SERVIDOR
                        . ";port="     . BD_PUERTO
                        . ";dbname="   . BD_NOMBRE
                        . ";charset=utf8mb4";
        $opciones = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $conexion = new PDO($cadenaConexion, BD_USUARIO, BD_CONTRASENA, $opciones);
        } catch (PDOException $error) {
            http_response_code(500);
            echo json_encode(['correcto' => false, 'mensaje' => 'Error de conexión: ' . $error->getMessage()]);
            exit;
        }
    }
    return $conexion;
}

// ─── Cabeceras para desarrollo local (CORS) ──────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Devuelve respuesta JSON y termina ────────────────
function responderJSON(array $datos, int $codigoHttp = 200): void {
    http_response_code($codigoHttp);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ─── Lee el cuerpo JSON del request ──────────────────
function leerCuerpoJSON(): array {
    $contenidoRaw = file_get_contents('php://input');
    return json_decode($contenidoRaw, true) ?? [];
}
