
// --- Constantes y Estado Global ---
const LOCALSTORAGE_KEY = 'medicamentosData_v2'; // Cambiar clave si la estructura de datos cambia significativamente
const ESTADOS = { PENDIENTE: 'Pendiente', TOMADA: 'Tomada', OMITIDA: 'Omitida' };
const ESTADOS_ARRAY = Object.values(ESTADOS);
let medicamentos = []; // Estado principal

// --- Módulo: Utilidades (Fechas, etc.) ---
const Utils = {
    formatHora: (date) => {
        if (!(date instanceof Date) || isNaN(date)) return "N/A";
        const horas = date.getHours().toString().padStart(2, '0');
        const minutos = date.getMinutes().toString().padStart(2, '0');
        return `${horas}:${minutos}`;
    },
    formatFechaHora: (date) => {
        if (!(date instanceof Date) || isNaN(date)) return "N/A";
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${Utils.formatHora(date)}`;
    },
    parseDateTimePickerValue: (dateTimeString) => {
        if (!dateTimeString) return null;
        return new Date(dateTimeString);
    },
    formatForDateTimePicker: (date) => {
        if (!(date instanceof Date) || isNaN(date)) return "";
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
};

// --- Módulo: Manejo de Datos (LocalStorage, Cálculo Historial) ---
const DataManager = {
    guardarMedicamentos: () => {
        try {
            const dataToSave = medicamentos.map(med => ({
                ...med,
                fechaHoraPrimeraDosis: med.fechaHoraPrimeraDosis instanceof Date ? med.fechaHoraPrimeraDosis.toISOString() : med.fechaHoraPrimeraDosis,
                historial: med.historial.map(dosis => ({
                    ...dosis,
                    fechaHoraProgramada: dosis.fechaHoraProgramada instanceof Date ? dosis.fechaHoraProgramada.toISOString() : dosis.fechaHoraProgramada
                }))
            }));
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(dataToSave));
            // console.log("Datos guardados en localStorage.");
        } catch (error) {
            console.error("Error al guardar en localStorage:", error);
            alert("No se pudieron guardar los datos. El almacenamiento local podría estar lleno o deshabilitado.");
        }
    },
    cargarMedicamentos: () => {
        const dataGuardada = localStorage.getItem(LOCALSTORAGE_KEY);
        if (!dataGuardada) return [];
        try {
            const datosParseados = JSON.parse(dataGuardada);
            return datosParseados.map(med => ({
                ...med,
                fechaHoraPrimeraDosis: med.fechaHoraPrimeraDosis ? new Date(med.fechaHoraPrimeraDosis) : null,
                historial: med.historial.map(dosis => ({
                    ...dosis,
                    fechaHoraProgramada: dosis.fechaHoraProgramada ? new Date(dosis.fechaHoraProgramada) : null
                }))
            }));
        } catch (error) {
            console.error("Error al parsear datos de localStorage:", error);
            alert("Error al cargar los datos guardados. Se iniciará con una lista vacía.");
            localStorage.removeItem(LOCALSTORAGE_KEY);
            return [];
        }
    },
    calcularHistorialCompleto: (medicamento) => {
         medicamento.historial = [];
         const fechaPrimera = medicamento.fechaHoraPrimeraDosis;
         if (!fechaPrimera || !(fechaPrimera instanceof Date) || isNaN(fechaPrimera)) {
             console.error("Fecha de primera dosis inválida:", medicamento.nombre);
             return;
         }
         for (let i = 0; i < medicamento.dosisIniciales; i++) {
             let fechaDosis = new Date(fechaPrimera);
             fechaDosis.setHours(fechaDosis.getHours() + (i * medicamento.frecuenciaHoras));
             medicamento.historial.push({
                 indice: i,
                 fechaHoraProgramada: fechaDosis,
                 estado: ESTADOS.PENDIENTE,
             });
         }
         // console.log(`Historial recalculado para ${medicamento.nombre}`);
    },
    obtenerProximaDosisPendiente: (medicamento) => {
        if (!medicamento.historial || medicamento.historial.length === 0) return null;
        const ahora = new Date(); // Se podría usar para omitir pasadas, pero la lógica actual ya lo hace bien
        return medicamento.historial
                   .filter(d => d.estado === ESTADOS.PENDIENTE && d.fechaHoraProgramada instanceof Date && !isNaN(d.fechaHoraProgramada))
                   .sort((a, b) => a.fechaHoraProgramada - b.fechaHoraProgramada)[0] || null;
    },
    contarDosisPorEstado: (medicamento, estado) => {
        if (!medicamento.historial) return 0;
        return medicamento.historial.filter(dosis => dosis.estado === estado).length;
    },
     contarDosisRestantesTabla: (medicamento) => {
         return DataManager.contarDosisPorEstado(medicamento, ESTADOS.PENDIENTE);
     },
     marcarDosisComo: (medId, dosisIdx, nuevoEstado) => {
        const medicamento = medicamentos.find(m => m.id === medId);
        if (!medicamento || isNaN(dosisIdx) || !ESTADOS_ARRAY.includes(nuevoEstado)) {
            console.error("Error al intentar marcar dosis: Datos inválidos", medId, dosisIdx, nuevoEstado);
            alert("Error interno al intentar actualizar el estado de la dosis.");
            return false; // Indicar fallo
        }
        const dosis = medicamento.historial?.find(d => d.indice === dosisIdx);
        if (dosis) {
            if (dosis.estado !== nuevoEstado) {
                console.log(`Cambiando estado Dosis ${dosisIdx + 1} de ${medicamento.nombre} a ${nuevoEstado}`);
                dosis.estado = nuevoEstado;
                DataManager.guardarMedicamentos(); // Guardar cambio
                return true; // Indicar éxito
            }
            return false; // No hubo cambio
        } else {
            console.error(`Error: No se encontró la dosis con índice ${dosisIdx} para el medicamento ${medId}`);
            alert("Error interno: No se encontró la dosis especificada.");
            return false; // Indicar fallo
        }
    }
};

// --- Módulo: Renderizado de UI ---
const UIRenderer = {
    renderizarTabla: () => {
        const tablaBody = document.getElementById('tabla-medicamentos');
        tablaBody.innerHTML = '';
        medicamentos.forEach(med => {
            const proximaDosis = DataManager.obtenerProximaDosisPendiente(med);
            const dosisPendientes = DataManager.contarDosisRestantesTabla(med);
            const fila = document.createElement('tr');
            const proximaDosisTexto = proximaDosis ? Utils.formatFechaHora(proximaDosis.fechaHoraProgramada) : (dosisPendientes === 0 ? "Completo" : "N/A");
            const infoTitle = `Presentación: ${med.presentacion || 'N/A'} | Vía: ${med.viaAdministracion || 'N/A'} | Inicio: ${Utils.formatFechaHora(med.fechaHoraPrimeraDosis)} | Total: ${med.dosisIniciales}`;

            fila.innerHTML = `
                <td><span class="medicamento-info" title="${infoTitle}">${med.nombre}</span></td>
                <td>${med.dosis}</td>
                <td>${proximaDosisTexto}</td>
                <td>${dosisPendientes}/${med.dosisIniciales}</td>
                <td>
                    <button class="accion-btn btn-recordar" data-med-id="${med.id}" ${!proximaDosis ? 'disabled' : ''} title="Recordar próxima">🔔</button>
                    <button class="accion-btn btn-tomada" data-med-id="${med.id}" data-dosis-idx="${proximaDosis ? proximaDosis.indice : ''}" ${!proximaDosis ? 'disabled' : ''} title="Marcar tomada">✔️</button>
                    <button class="accion-btn btn-editar" data-med-id="${med.id}" title="Editar">✏️</button>
                    <button class="accion-btn btn-eliminar" data-med-id="${med.id}" title="Eliminar">🗑️</button>
                </td>
            `; // Usando emojis para ahorrar espacio en móvil
            tablaBody.appendChild(fila);
        });
        // Re-añadir listeners específicos de la tabla (delegación ya se encarga del click general)
         document.querySelectorAll('.medicamento-info').forEach(span => {
            span.removeEventListener('click', EventHandlers.handleInfoClick); // Limpia si existe
            span.addEventListener('click', EventHandlers.handleInfoClick);
        });
    },
    renderizarDashboard: () => {
        const dashboardDiv = document.getElementById('dashboard-historico');
        dashboardDiv.innerHTML = '';
         if (medicamentos.length === 0) {
            dashboardDiv.innerHTML = '<p style="text-align:center; color: #777; padding-top: 20px;">Aún no hay medicamentos registrados.</p>';
            return;
        }
        medicamentos.forEach(med => {
            const historialOrdenado = med.historial ? [...med.historial].sort((a, b) => a.fechaHoraProgramada - b.fechaHoraProgramada) : [];
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'dashboard-section';
            sectionDiv.innerHTML = `<h3>${med.nombre} (${DataManager.contarDosisPorEstado(med, ESTADOS.TOMADA)} ✓, ${DataManager.contarDosisPorEstado(med, ESTADOS.OMITIDA)} ✕, ${DataManager.contarDosisPorEstado(med, ESTADOS.PENDIENTE)} ?)</h3>`;

            if (historialOrdenado.length > 0) {
                const lista = document.createElement('ul');
                lista.style.listStyle = 'none';
                lista.style.paddingLeft = '0';
                historialOrdenado.forEach(dosis => {
                    const item = document.createElement('li');
                    const estadoClass = `estado-${dosis.estado.toLowerCase()}`;
                    item.className = `historial-item ${estadoClass}`;
                    item.innerHTML = `
                        <span>Dosis ${dosis.indice + 1}: ${Utils.formatFechaHora(dosis.fechaHoraProgramada)}</span>
                        <select class="estado-select" data-med-id="${med.id}" data-dosis-idx="${dosis.indice}">
                            ${ESTADOS_ARRAY.map(estado => `<option value="${estado}" ${dosis.estado === estado ? 'selected' : ''}>${estado}</option>`).join('')}
                        </select>
                    `;
                    lista.appendChild(item);
                });
                sectionDiv.appendChild(lista);
            } else {
                sectionDiv.innerHTML += '<p style="color: #777; font-style: italic; font-size: 0.9em; padding-left: 10px;">No hay historial calculado.</p>';
            }
            dashboardDiv.appendChild(sectionDiv);
        });
    },
    renderizarUICompleta: () => {
        UIRenderer.renderizarTabla();
        UIRenderer.renderizarDashboard();
    }
};

// --- Módulo: Navegación ---
const Navigation = {
    mostrarPagina: (pageId) => {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(pageId)?.classList.add('active');

        document.querySelectorAll('#bottom-nav button').forEach(btn => btn.classList.remove('active'));
        if (pageId === 'page-reminders') document.getElementById('nav-reminders')?.classList.add('active');
        else if (pageId === 'page-dashboard') document.getElementById('nav-dashboard')?.classList.add('active');
        else if (pageId === 'page-form') document.getElementById('nav-add')?.classList.add('active');
         // Scroll al inicio de la nueva página
         document.getElementById('content-area').scrollTop = 0;
    },
    irAAgregar: () => {
        FormManager.resetearFormulario(); // Asegura que esté en modo "Añadir"
        Navigation.mostrarPagina('page-form');
    },
    irAEditar: (medId) => {
        if (FormManager.prepararFormularioParaEditar(medId)) {
            Navigation.mostrarPagina('page-form');
        }
    },
     configurarNavegacion: () => {
         document.getElementById('nav-reminders')?.addEventListener('click', () => Navigation.mostrarPagina('page-reminders'));
         document.getElementById('nav-dashboard')?.addEventListener('click', () => Navigation.mostrarPagina('page-dashboard'));
         document.getElementById('nav-add')?.addEventListener('click', Navigation.irAAgregar);
     }
};

// --- Módulo: Gestión del Formulario ---
const FormManager = {
    resetearFormulario: () => {
        const form = document.getElementById('form-medicamento');
        form.reset();
        document.getElementById('med-id-editando').value = '';
        document.getElementById('form-titulo').textContent = "Añadir Nuevo Medicamento";
        document.getElementById('btn-guardar-medicamento').textContent = "Guardar Medicamento";
        document.getElementById('btn-cancelar-edicion').style.display = 'none';
    },
    prepararFormularioParaEditar: (medId) => {
         const medicamento = medicamentos.find(m => m.id === medId);
         if (!medicamento) return false;

         document.getElementById('med-id-editando').value = medId;
         document.getElementById('med-nombre').value = medicamento.nombre;
         document.getElementById('med-dosis').value = medicamento.dosis;
         document.getElementById('med-presentacion').value = medicamento.presentacion || '';
         document.getElementById('med-via').value = medicamento.viaAdministracion || '';
         document.getElementById('med-dosis-iniciales').value = medicamento.dosisIniciales;
         document.getElementById('med-frecuencia').value = medicamento.frecuenciaHoras;
         document.getElementById('med-primera-dosis').value = Utils.formatForDateTimePicker(medicamento.fechaHoraPrimeraDosis);
         document.getElementById('form-titulo').textContent = "Editar Medicamento";
         document.getElementById('btn-guardar-medicamento').textContent = "Actualizar Medicamento";
         document.getElementById('btn-cancelar-edicion').style.display = 'inline-block';
         return true;
    },
    handleFormSubmit: (event) => {
        event.preventDefault();
        const medIdEditando = document.getElementById('med-id-editando').value;
        const esEdicion = medIdEditando !== '';

        const nombre = document.getElementById('med-nombre').value.trim();
        const dosis = document.getElementById('med-dosis').value.trim();
        const presentacion = document.getElementById('med-presentacion').value.trim();
        const via = document.getElementById('med-via').value.trim();
        const dosisIniciales = parseInt(document.getElementById('med-dosis-iniciales').value);
        const frecuencia = parseInt(document.getElementById('med-frecuencia').value);
        const fechaHoraPrimeraDosisStr = document.getElementById('med-primera-dosis').value;

         if (!nombre || !dosis || isNaN(dosisIniciales) || isNaN(frecuencia) || !fechaHoraPrimeraDosisStr || dosisIniciales <= 0 || frecuencia <= 0) {
             alert("Completa los campos obligatorios con valores válidos."); return;
         }
         const fechaHoraPrimeraDosis = Utils.parseDateTimePickerValue(fechaHoraPrimeraDosisStr);
          if (!fechaHoraPrimeraDosis || isNaN(fechaHoraPrimeraDosis)) {
             alert("Fecha de primera dosis inválida."); return;
         }

        if (esEdicion) {
            const medicamento = medicamentos.find(m => m.id === medIdEditando);
            if (!medicamento) { alert("Error: Medicamento no encontrado."); FormManager.resetearFormulario(); return; }

            const historialCambio = medicamento.dosisIniciales !== dosisIniciales ||
                                    medicamento.frecuenciaHoras !== frecuencia ||
                                    medicamento.fechaHoraPrimeraDosis.getTime() !== fechaHoraPrimeraDosis.getTime();

            medicamento.nombre = nombre;
            medicamento.dosis = dosis;
            medicamento.presentacion = presentacion;
            medicamento.viaAdministracion = via;
            medicamento.dosisIniciales = dosisIniciales;
            medicamento.frecuenciaHoras = frecuencia;
            medicamento.fechaHoraPrimeraDosis = fechaHoraPrimeraDosis;

            if (historialCambio) {
                if (confirm("Datos de programación cambiados. ¿Recalcular historial? (Reiniciará estados futuros)")) {
                    DataManager.calcularHistorialCompleto(medicamento);
                } else {
                     alert("Edición guardada, historial no recalculado.");
                }
            }
            alert(`Medicamento "${medicamento.nombre}" actualizado.`);
        } else {
            const nuevoMedicamento = {
                id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                nombre, dosis, presentacion, viaAdministracion: via,
                dosisIniciales, frecuenciaHoras: frecuencia, fechaHoraPrimeraDosis,
                historial: []
            };
            DataManager.calcularHistorialCompleto(nuevoMedicamento);
            medicamentos.push(nuevoMedicamento);
            alert(`Medicamento "${nuevoMedicamento.nombre}" añadido.`);
        }

        DataManager.guardarMedicamentos();
        UIRenderer.renderizarUICompleta(); // Actualizar tabla y dashboard
        FormManager.resetearFormulario(); // Limpiar formulario
        Navigation.mostrarPagina('page-reminders'); // Volver a la página principal
    },
     configurarFormulario: () => {
         document.getElementById('form-medicamento').addEventListener('submit', FormManager.handleFormSubmit);
         document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
             FormManager.resetearFormulario();
             Navigation.mostrarPagina('page-reminders'); // Cancelar edición te lleva a la lista
         });
     }
};

// --- Módulo: Manejadores de Eventos (Tabla, Dashboard, etc.) ---
const EventHandlers = {
    handleTableClick: (event) => {
        const target = event.target.closest('.accion-btn'); // Busca el botón más cercano
         if (!target) return; // Click fuera de un botón de acción

         const medId = target.dataset.medId;
         if (target.classList.contains('btn-recordar')) EventHandlers.handleRecordarClick(medId);
         else if (target.classList.contains('btn-tomada')) EventHandlers.handleTomadaClick(medId, target.dataset.dosisIdx);
         else if (target.classList.contains('btn-editar')) Navigation.irAEditar(medId); // Navega a editar
         else if (target.classList.contains('btn-eliminar')) EventHandlers.handleEliminarClick(medId);
    },
     handleDashboardChange: (event) => {
         if (event.target.classList.contains('estado-select')) {
             const select = event.target;
             const medId = select.dataset.medId;
             const dosisIdx = parseInt(select.dataset.dosisIdx);
             const nuevoEstado = select.value;
             // Marcar dosis y si hay éxito, rerenderizar TODO para consistencia
             if (DataManager.marcarDosisComo(medId, dosisIdx, nuevoEstado)) {
                // Podríamos solo actualizar el dashboard, pero rerenderizar todo es más seguro
                UIRenderer.renderizarUICompleta();
                 // Restaurar la posición del scroll del dashboard puede ser complejo,
                 // por ahora se pierde al rerenderizar todo.
                 // Para mejorar esto, se necesitaría lógica más fina de actualización del DOM.
            } else {
                 // Si no hubo cambio real, revertir el select visualmente
                 const med = medicamentos.find(m => m.id === medId);
                 const dosis = med?.historial.find(d => d.indice === dosisIdx);
                 if(dosis) select.value = dosis.estado;
            }
         }
     },
    handleInfoClick: (event) => {
        alert(event.target.title);
    },
    handleRecordarClick: (medId) => {
        const medicamento = medicamentos.find(m => m.id === medId);
        if (!medicamento) return;
        const proximaDosis = DataManager.obtenerProximaDosisPendiente(medicamento);
        if (proximaDosis) {
             // --- Lógica de Recordatorio (SIMPLE ALERT) ---
            const ahora = new Date();
            const tiempoRestante = proximaDosis.fechaHoraProgramada - ahora;
            if (tiempoRestante <= 0) {
                alert(`La hora para ${medicamento.nombre} (${Utils.formatHora(proximaDosis.fechaHoraProgramada)}) ya pasó o es ahora.`);
                return;
            }
            alert(`Recordatorio (simulado) programado para ${medicamento.nombre} a las ${Utils.formatHora(proximaDosis.fechaHoraProgramada)}.\nRecuerda marcarla como 'Tomada'.`);
             // En una app real, usarías notificaciones push o la API de notificaciones del navegador
            /* setTimeout(() => {
                // Esto solo funciona si la pestaña sigue abierta
                alert(`¡RECORDATORIO! Es hora de tomar: ${medicamento.nombre}`);
            }, tiempoRestante); */
        } else {
            alert(`No hay dosis pendientes para ${medicamento.nombre}.`);
        }
    },
    handleTomadaClick: (medId, dosisIdxStr) => {
        if (dosisIdxStr === '' || dosisIdxStr === undefined) {
            alert("No hay próxima dosis para marcar."); return;
        }
        const dosisIdx = parseInt(dosisIdxStr);
        if (DataManager.marcarDosisComo(medId, dosisIdx, ESTADOS.TOMADA)) {
             UIRenderer.renderizarUICompleta(); // Rerenderizar todo
        }
    },
    handleEliminarClick: (medId) => {
        const medicamento = medicamentos.find(m => m.id === medId);
        if (!medicamento) return;
        if (confirm(`¿Eliminar "${medicamento.nombre}" y su historial?`)) {
            medicamentos = medicamentos.filter(m => m.id !== medId);
            DataManager.guardarMedicamentos();
            UIRenderer.renderizarUICompleta();
            alert(`"${medicamento.nombre}" eliminado.`);
            // Si estamos en el dashboard, y eliminamos el último, podríamos volver a 'reminders'
            if (medicamentos.length === 0 && document.getElementById('page-dashboard').classList.contains('active')) {
                Navigation.mostrarPagina('page-reminders');
            }
        }
    },
     configurarListenersGenerales: () => {
         // Usar delegación para la tabla y el dashboard
         document.getElementById('tabla-medicamentos').addEventListener('click', EventHandlers.handleTableClick);
         document.getElementById('dashboard-historico').addEventListener('change', EventHandlers.handleDashboardChange);
         // Los listeners de info se añaden en renderizarTabla
     }
};

// --- Módulo: Inicialización ---
const App = {
    init: () => {
        console.log("Inicializando app...");
        medicamentos = DataManager.cargarMedicamentos();
        Navigation.configurarNavegacion();
        FormManager.configurarFormulario();
        EventHandlers.configurarListenersGenerales();
        UIRenderer.renderizarUICompleta();
        Navigation.mostrarPagina('page-reminders'); // Asegura que la página inicial sea la correcta
        console.log("App inicializada. Datos cargados:", medicamentos.length);
    }
};

// Ejecutar inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', App.init);

