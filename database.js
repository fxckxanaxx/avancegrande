// ==========================================
// DATABASE.JS - Conexión con Supabase
// REG Marketing S.A.S - Sistema de Producción
// ==========================================

const SUPABASE_URL = 'https://qyzmijeachrzzpitfdxf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5em1pamVhY2hyenpwaXRmZHhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzg4NDgsImV4cCI6MjA4Njk1NDg0OH0.01PQASOkdzqUP3kyf5h0SlWoIatN7hmW_PtVueIPsiE';

// Importar Supabase desde CDN
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// FUNCIONES PARA ÓRDENES
// ==========================================

/**
 * Obtener todas las órdenes activas
 */
async function obtenerOrdenes() {
    try {
        const { data, error } = await supabaseClient
            .from('ordenes')
            .select('*')
            .eq('estado_general', 'activa')
            .order('fecha_creacion', { ascending: false });
        
        if (error) throw error;
        
        // Convertir formato de base de datos a formato del sistema
        return data.map(convertirOrdenDesdeBD);
    } catch (error) {
        console.error('Error al obtener órdenes:', error);
        return [];
    }
}

/**
 * Crear nueva orden
 */
async function crearOrden(orden) {
    try {
        const ordenBD = convertirOrdenParaBD(orden);
        
        const { data, error } = await supabaseClient
            .from('ordenes')
            .insert([ordenBD])
            .select();
        
        if (error) throw error;
        
        console.log('✅ Orden creada en Supabase:', data[0].numero_orden);
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('❌ Error al crear orden:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Actualizar orden existente
 */
async function actualizarOrden(numeroOrden, orden) {
    try {
        // Convertir orden a formato de BD
        const ordenBD = convertirOrdenParaBD(orden);
        
        const { data, error } = await supabaseClient
            .from('ordenes')
            .update(ordenBD)
            .eq('numero_orden', numeroOrden)
            .select();
        
        if (error) throw error;
        
        console.log('✅ Orden actualizada:', numeroOrden);
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('❌ Error al actualizar orden:', error);
        return { success: false, error: error.message };
    }
}


/**
 * Actualizar estado de un área específica
 */
async function actualizarEstadoArea(numeroOrden, area, nuevoEstado) {
    try {
        const campo = `estado_${area}`;
        
        const { data, error } = await supabaseClient
            .from('ordenes')
            .update({ [campo]: nuevoEstado })
            .eq('numero_orden', numeroOrden)
            .select();
        
        if (error) throw error;
        
        console.log('✅ Estado actualizado:', numeroOrden, area, '→', nuevoEstado);
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('❌ Error al actualizar estado:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Actualizar progreso de un área (por talla)
 */
async function actualizarProgresoArea(numeroOrden, area, progreso) {
    try {
        const campo = `progreso_${area}`;
        
        const { data, error } = await supabaseClient
            .from('ordenes')
            .update({ [campo]: progreso })
            .eq('numero_orden', numeroOrden)
            .select();
        
        if (error) throw error;
        
        console.log('✅ Progreso actualizado:', numeroOrden, area);
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('❌ Error al actualizar progreso:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Eliminar orden
 */
async function eliminarOrden(numeroOrden) {
    try {
        const { error } = await supabaseClient
            .from('ordenes')
            .delete()
            .eq('numero_orden', numeroOrden);
        
        if (error) throw error;
        
        console.log('✅ Orden eliminada:', numeroOrden);
        return { success: true };
    } catch (error) {
        console.error('❌ Error al eliminar orden:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mover orden al historial
 */
async function moverAHistorial(orden) {
    try {
        // 1. Guardar en historial
        const totalPrendas = Object.values(orden.tallas).reduce((sum, val) => sum + val, 0);
        
        const { error: errorHistorial } = await supabaseClient
            .from('historial_ordenes')
            .insert([{
                numero_orden: orden.numeroOrden,
                cliente: orden.cliente,
                tipo_prenda: orden.tipoPrenda,
                total_prendas: totalPrendas,
                fecha_pedido: orden.fechaPedido,
                fecha_entrega: orden.fechaEntrega,
                fecha_completado: new Date().toISOString(),
                datos_completos: orden
            }]);
        
        if (errorHistorial) throw errorHistorial;
        
        // 2. Actualizar estado en órdenes
        const { error: errorUpdate } = await supabaseClient
            .from('ordenes')
            .update({
                estado_general: 'completada',
                fecha_completado: new Date().toISOString()
            })
            .eq('numero_orden', orden.numeroOrden);
        
        if (errorUpdate) throw errorUpdate;
        
        console.log('✅ Orden movida al historial:', orden.numeroOrden);
        return { success: true };
    } catch (error) {
        console.error('❌ Error al mover al historial:', error);
        return { success: false, error: error.message };
    }
    
}

/**
 * Obtener historial de órdenes
 */
async function obtenerHistorial() {
    try {
        const { data, error } = await supabaseClient
            .from('historial_ordenes')
            .select('*')
            .order('fecha_completado', { ascending: false });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error al obtener historial:', error);
        return [];
    }
}

// ==========================================
// FUNCIONES DE CONVERSIÓN
// ==========================================

/**
 * Convertir orden del formato del sistema al formato de BD
 */
function convertirOrdenParaBD(orden) {
    return {
        numero_orden: orden.numeroOrden,
        cliente: orden.cliente,
        fecha_pedido: orden.fechaPedido,
        fecha_entrega: orden.fechaEntrega,
        arte: orden.arte,
        impresora: orden.impresora,
        tipo_prenda: orden.tipoPrenda,
        tipo_prenda_valor: orden.tipoPrenda,
        tela: orden.tela,
        cuello: orden.cuello,
        color_cuello: orden.colorCuello,
        marquilla: orden.marquilla,
        descripcion_pedido: orden.descripcionPedido,
        ancho: orden.ancho,
        molde: orden.molde,
        ancho_bies: orden.anchoBies,
        dobladillo: orden.dobladillo,
        requerimientos: orden.requerimientos,
        observaciones: orden.observaciones,
        imagen_diseno: orden.imagenDiseno,
        cantidad_total: orden.cantidadTotal || 0,
        
        // Tallas infantiles
                // Tallas infantiles
        talla_2t: (orden.tallas && orden.tallas['2T']) || 0,
        talla_3t: (orden.tallas && orden.tallas['3T']) || 0,
        talla_4t: (orden.tallas && orden.tallas['4T']) || 0,
        talla_5t: (orden.tallas && orden.tallas['5T']) || 0,
        talla_2: (orden.tallas && orden.tallas['2']) || 0,
        talla_4: (orden.tallas && orden.tallas['4']) || 0,
        talla_6: (orden.tallas && orden.tallas['6']) || 0,
        talla_8: (orden.tallas && orden.tallas['8']) || 0,
        talla_10: (orden.tallas && orden.tallas['10']) || 0,
        talla_12: (orden.tallas && orden.tallas['12']) || 0,
        talla_14: (orden.tallas && orden.tallas['14']) || 0,
        talla_16: (orden.tallas && orden.tallas['16']) || 0,

        // Tallas adulto
        talla_xs: (orden.tallas && orden.tallas['XS']) || 0,
        talla_s: (orden.tallas && orden.tallas['S']) || 0,
        talla_m: (orden.tallas && orden.tallas['M']) || 0,
        talla_l: (orden.tallas && orden.tallas['L']) || 0,
        talla_xl: (orden.tallas && orden.tallas['XL']) || 0,
        talla_2xl: (orden.tallas && orden.tallas['2XL']) || 0,
        talla_3xl: (orden.tallas && orden.tallas['3XL']) || 0,
        talla_4xl: (orden.tallas && orden.tallas['4XL']) || 0,

        // Tallas de Pantalón Mujer
        talla_pantalon_mujer_4: (orden.tallas && orden.tallas['PM-4']) || 0,
        talla_pantalon_mujer_6: (orden.tallas && orden.tallas['PM-6']) || 0,
        talla_pantalon_mujer_8: (orden.tallas && orden.tallas['PM-8']) || 0,
        talla_pantalon_mujer_10: (orden.tallas && orden.tallas['PM-10']) || 0,
        talla_pantalon_mujer_12: (orden.tallas && orden.tallas['PM-12']) || 0,
        talla_pantalon_mujer_14: (orden.tallas && orden.tallas['PM-14']) || 0,
        talla_pantalon_mujer_16: (orden.tallas && orden.tallas['PM-16']) || 0,
        talla_pantalon_mujer_18: (orden.tallas && orden.tallas['PM-18']) || 0,
        talla_pantalon_mujer_20: (orden.tallas && orden.tallas['PM-20']) || 0,
        talla_pantalon_mujer_22: (orden.tallas && orden.tallas['PM-22']) || 0,

        // Tallas de Pantalón Hombre
        talla_pantalon_hombre_26: (orden.tallas && orden.tallas['PH-26']) || 0,
        talla_pantalon_hombre_28: (orden.tallas && orden.tallas['PH-28']) || 0,
        talla_pantalon_hombre_30: (orden.tallas && orden.tallas['PH-30']) || 0,
        talla_pantalon_hombre_32: (orden.tallas && orden.tallas['PH-32']) || 0,
        talla_pantalon_hombre_34: (orden.tallas && orden.tallas['PH-34']) || 0,
        talla_pantalon_hombre_36: (orden.tallas && orden.tallas['PH-36']) || 0,
        talla_pantalon_hombre_38: (orden.tallas && orden.tallas['PH-38']) || 0,
        talla_pantalon_hombre_40: (orden.tallas && orden.tallas['PH-40']) || 0,
        talla_pantalon_hombre_42: (orden.tallas && orden.tallas['PH-42']) || 0,
        talla_pantalon_hombre_44: (orden.tallas && orden.tallas['PH-44']) || 0,

        // Tallas de Pantalonetas
        talla_pantaloneta_s: (orden.tallas && orden.tallas['PT-S']) || 0,
        talla_pantaloneta_m: (orden.tallas && orden.tallas['PT-M']) || 0,
        talla_pantaloneta_l: (orden.tallas && orden.tallas['PT-L']) || 0,
        talla_pantaloneta_xl: (orden.tallas && orden.tallas['PT-XL']) || 0,

        // Tallas de Pantalones Pijama
        talla_pijama_s: (orden.tallas && orden.tallas['PJ-S']) || 0,
        talla_pijama_m: (orden.tallas && orden.tallas['PJ-M']) || 0,
        talla_pijama_l: (orden.tallas && orden.tallas['PJ-L']) || 0,
        talla_pijama_xl: (orden.tallas && orden.tallas['PJ-XL']) || 0,

        // Tallas de Sudaderas/Joggers
        talla_sudadera_s: (orden.tallas && orden.tallas['SD-S']) || 0,
        talla_sudadera_m: (orden.tallas && orden.tallas['SD-M']) || 0,
        talla_sudadera_l: (orden.tallas && orden.tallas['SD-L']) || 0,
        talla_sudadera_xl: (orden.tallas && orden.tallas['SD-XL']) || 0,

        // Tallas de Chaquetas
        talla_chaqueta_s: (orden.tallas && orden.tallas['CH-S']) || 0,
        talla_chaqueta_m: (orden.tallas && orden.tallas['CH-M']) || 0,
        talla_chaqueta_l: (orden.tallas && orden.tallas['CH-L']) || 0,
        talla_chaqueta_xl: (orden.tallas && orden.tallas['CH-XL']) || 0,
        // Estados
        estado_corte: orden.estado?.corte || 'pendiente',
        estado_confeccion: orden.estado?.confeccion || 'pendiente',
        estado_impresion: orden.estado?.impresion || 'pendiente',
        estado_sublimacion: orden.estado?.sublimacion || 'pendiente',
        estado_despacho: orden.estado?.despacho || 'pendiente',
        estado_dtf: orden.estado?.dtf || 'pendiente',
        estado_estampado: orden.estado?.estampado || 'pendiente',
        estado_corte_laser: orden.estado?.corteLaser || 'pendiente',

        progreso_corte: orden.progreso_corte || {},
        progreso_confeccion: orden.progreso_confeccion || {},
        progreso_impresion: orden.progreso_impresion || {},
        progreso_sublimacion: orden.progreso_sublimacion || {},
        progreso_despacho: orden.progreso_despacho || {},
        progreso_dtf: orden.progreso_dtf || {},
        progreso_estampado: orden.progreso_estampado || {},
        progreso_corte_laser: orden.progreso_corte_laser || {}
    };
}

/**
 * Convertir orden del formato de BD al formato del sistema
 */
function convertirOrdenDesdeBD(ordenBD) {
    return {
        numeroOrden: ordenBD.numero_orden,
        cliente: ordenBD.cliente,
        fechaPedido: ordenBD.fecha_pedido,
        fechaEntrega: ordenBD.fecha_entrega,
        arte: ordenBD.arte,
        impresora: ordenBD.impresora,
        tipoPrenda: ordenBD.tipo_prenda_valor || ordenBD.tipo_prenda,
        tela: ordenBD.tela,
        cuello: ordenBD.cuello,
        colorCuello: ordenBD.color_cuello,
        marquilla: ordenBD.marquilla,
        descripcionPedido: ordenBD.descripcion_pedido,
        ancho: ordenBD.ancho,
        molde: ordenBD.molde,
        anchoBies: ordenBD.ancho_bies,
        dobladillo: ordenBD.dobladillo,
        requerimientos: ordenBD.requerimientos,
        observaciones: ordenBD.observaciones,
        imagenDiseno: ordenBD.imagen_diseno,
        cantidadTotal: ordenBD.cantidad_total,
        
        // Tallas
        tallas: {
            '2T': ordenBD.talla_2t || 0,
            '3T': ordenBD.talla_3t || 0,
            '4T': ordenBD.talla_4t || 0,
            '5T': ordenBD.talla_5t || 0,
            '2': ordenBD.talla_2 || 0,
            '4': ordenBD.talla_4 || 0,
            '6': ordenBD.talla_6 || 0,
            '8': ordenBD.talla_8 || 0,
            '10': ordenBD.talla_10 || 0,
            '12': ordenBD.talla_12 || 0,
            '14': ordenBD.talla_14 || 0,
            '16': ordenBD.talla_16 || 0,
            'XS': ordenBD.talla_xs || 0,
            'S': ordenBD.talla_s || 0,
            'M': ordenBD.talla_m || 0,
            'L': ordenBD.talla_l || 0,
            'XL': ordenBD.talla_xl || 0,
            '2XL': ordenBD.talla_2xl || 0,
            '3XL': ordenBD.talla_3xl || 0,
            '4XL': ordenBD.talla_4xl || 0,
            // Pantalón Mujer
            'PM-4': ordenBD.talla_pantalon_mujer_4 || 0,
            'PM-6': ordenBD.talla_pantalon_mujer_6 || 0,
            'PM-8': ordenBD.talla_pantalon_mujer_8 || 0,
            'PM-10': ordenBD.talla_pantalon_mujer_10 || 0,
            'PM-12': ordenBD.talla_pantalon_mujer_12 || 0,
            'PM-14': ordenBD.talla_pantalon_mujer_14 || 0,
            'PM-16': ordenBD.talla_pantalon_mujer_16 || 0,
            'PM-18': ordenBD.talla_pantalon_mujer_18 || 0,
            'PM-20': ordenBD.talla_pantalon_mujer_20 || 0,
            'PM-22': ordenBD.talla_pantalon_mujer_22 || 0,

            // Pantalón Hombre
            'PH-26': ordenBD.talla_pantalon_hombre_26 || 0,
            'PH-28': ordenBD.talla_pantalon_hombre_28 || 0,
            'PH-30': ordenBD.talla_pantalon_hombre_30 || 0,
            'PH-32': ordenBD.talla_pantalon_hombre_32 || 0,
            'PH-34': ordenBD.talla_pantalon_hombre_34 || 0,
            'PH-36': ordenBD.talla_pantalon_hombre_36 || 0,
            'PH-38': ordenBD.talla_pantalon_hombre_38 || 0,
            'PH-40': ordenBD.talla_pantalon_hombre_40 || 0,
            'PH-42': ordenBD.talla_pantalon_hombre_42 || 0,
            'PH-44': ordenBD.talla_pantalon_hombre_44 || 0,

            // Pantalonetas
            'PT-S': ordenBD.talla_pantaloneta_s || 0,
            'PT-M': ordenBD.talla_pantaloneta_m || 0,
            'PT-L': ordenBD.talla_pantaloneta_l || 0,
            'PT-XL': ordenBD.talla_pantaloneta_xl || 0,

            // Pijamas
            'PJ-S': ordenBD.talla_pijama_s || 0,
            'PJ-M': ordenBD.talla_pijama_m || 0,
            'PJ-L': ordenBD.talla_pijama_l || 0,
            'PJ-XL': ordenBD.talla_pijama_xl || 0,

            // Sudaderas
            'SD-S': ordenBD.talla_sudadera_s || 0,
            'SD-M': ordenBD.talla_sudadera_m || 0,
            'SD-L': ordenBD.talla_sudadera_l || 0,
            'SD-XL': ordenBD.talla_sudadera_xl || 0,

            // Chaquetas
            'CH-S': ordenBD.talla_chaqueta_s || 0,
            'CH-M': ordenBD.talla_chaqueta_m || 0,
            'CH-L': ordenBD.talla_chaqueta_l || 0,
            'CH-XL': ordenBD.talla_chaqueta_xl || 0
        },

        
        
        // Estados
        estado: {
            corte: ordenBD.estado_corte,
            confeccion: ordenBD.estado_confeccion,
            impresion: ordenBD.estado_impresion,
            sublimacion: ordenBD.estado_sublimacion,
            despacho: ordenBD.estado_despacho,
            dtf: ordenBD.estado_dtf,
            estampado: ordenBD.estado_estampado,
            corteLaser: ordenBD.estado_corte_laser
        },

        progreso_corte: ordenBD.progreso_corte || {},
        progreso_confeccion: ordenBD.progreso_confeccion || {},
        progreso_impresion: ordenBD.progreso_impresion || {},
        progreso_sublimacion: ordenBD.progreso_sublimacion || {},
        progreso_despacho: ordenBD.progreso_despacho || {},
        progreso_dtf: ordenBD.progreso_dtf || {},
        progreso_estampado: ordenBD.progreso_estampado || {},
        progreso_corte_laser: ordenBD.progreso_corte_laser || {}
    };
}
// ==========================================
// SINCRONIZACIÓN CON LOCALSTORAGE
// ==========================================

/**
 * Sincronizar datos locales con Supabase
 */
async function sincronizarConSupabase() {
    try {
        console.log('🔄 Sincronizando con Supabase...');
        
        // 1. Obtener órdenes de Supabase
        const ordenesSupabase = await obtenerOrdenes();
        
        // 2. Obtener órdenes locales
        const ordenesLocales = JSON.parse(localStorage.getItem('ordenes') || '[]');
        
        // 3. Si hay órdenes locales que no están en Supabase, subirlas
        for (const ordenLocal of ordenesLocales) {
            const existeEnSupabase = ordenesSupabase.find(o => o.numeroOrden === ordenLocal.numeroOrden);
            
            if (!existeEnSupabase) {
                console.log('📤 Subiendo orden local a Supabase:', ordenLocal.numeroOrden);
                await crearOrden(ordenLocal);
            }
        }
        
        // 4. Actualizar localStorage con datos de Supabase
        const ordenesActualizadas = await obtenerOrdenes();
        localStorage.setItem('ordenes', JSON.stringify(ordenesActualizadas));
        
        console.log('✅ Sincronización completada');
        return { success: true, total: ordenesActualizadas.length };
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Modo offline: guardar en localStorage como respaldo
 */
function guardarRespaldoLocal(key, data) {
    try {
        localStorage.setItem(`backup_${key}`, JSON.stringify(data));
    } catch (error) {
        console.error('Error al guardar respaldo local:', error);
    }
}

// ==========================================
// VERIFICACIÓN DE CONEXIÓN
// ==========================================

/**
 * Verificar si hay conexión con Supabase
 */
async function verificarConexion() {
    try {
        const { data, error } = await supabaseClient
            .from('ordenes')
            .select('id')
            .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Conexión con Supabase: OK');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión con Supabase:', error);
        return false;
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

// Verificar conexión al cargar
window.addEventListener('load', async () => {
    const conectado = await verificarConexion();
    
    if (conectado) {
        console.log('🌐 Sistema conectado a Supabase');
        // Sincronizar automáticamente
        await sincronizarConSupabase();
    } else {
        console.warn('⚠️ Modo offline - usando localStorage');
    }
});
// ==========================================
// LIMPIAR HISTORIAL
// ==========================================

/**
 * Limpiar todo el historial de órdenes
 */
async function limpiarHistorial() {
    try {
        const { error } = await supabaseClient
            .from('historial_ordenes')
            .delete()
            .gte('id', 0); // Eliminar todos los registros
        
        if (error) throw error;
        
        console.log('✅ Historial limpiado en Supabase');
        return { success: true };
    } catch (error) {
        console.error('❌ Error al limpiar historial:', error);
        return { success: false, error: error.message };
    }
}
// ==========================================
// EXPORTAR FUNCIONES
// ==========================================
async function obtenerSiguienteNumeroOrden() {
    try {
        const { data: activas } = await supabaseClient
            .from('ordenes')
            .select('numero_orden');

        const { data: historialData } = await supabaseClient
            .from('historial_ordenes')
            .select('numero_orden');

        let maxNum = 0;

        (activas || []).forEach(o => {
            const n = parseInt(o.numero_orden) || 0;
            if (n > maxNum) maxNum = n;
        });

        (historialData || []).forEach(o => {
            const n = parseInt(o.numero_orden) || 0;
            if (n > maxNum) maxNum = n;
        });

        return String(maxNum + 1).padStart(3, '0');
    } catch (error) {
        return null;
    }
}
// Para usar en otros archivos:
window.DB = {
    // Órdenes
    obtenerOrdenes,
    crearOrden,
    actualizarOrden,
    eliminarOrden,
    actualizarEstadoArea,
    actualizarProgresoArea,
    
    // Historial
    moverAHistorial,
    obtenerHistorial,
    limpiarHistorial,
    
    // Utilidades
    sincronizarConSupabase,
    verificarConexion,
    guardarRespaldoLocal,
    obtenerSiguienteNumeroOrden

};



console.log('✅ Database.js cargado correctamente');