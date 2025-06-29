// Configuración de variables meteorológicas
const WEATHER_VARIABLES = {
    temperature_2m: { 
        label: "Temperatura", 
        unit: "°C", 
        color: "#FF6B6B",
        type: "column"
    },
    rain: { 
        label: "Lluvia", 
        unit: "mm", 
        color: "#4ECDC4",
        type: "column"
    },
    snowfall: { 
        label: "Nieve", 
        unit: "cm", 
        color: "#A8E6CF",
        type: "column"
    },
    windspeed_10m: { 
        label: "Velocidad del Viento", 
        unit: "km/h", 
        color: "#FFD93D",
        type: "column"
    },
    windgusts_10m: { 
        label: "Ráfagas de Viento", 
        unit: "km/h", 
        color: "#FF8B94",
        type: "column"
    },
    relativehumidity_2m: { 
        label: "Humedad Relativa", 
        unit: "%", 
        color: "#6BCF7F",
        type: "column"
    },
    surface_pressure: { 
        label: "Presión Atmosférica", 
        unit: "hPa", 
        color: "#4D96FF",
        type: "column"
    },
    dewpoint_2m: { 
        label: "Punto de Rocío", 
        unit: "°C", 
        color: "#9B59B6",
        type: "column"
    }
};

// Variables globales
let chartInstances = [];
let analysisData = {};

/**
 * Calcula la correlación de Pearson entre dos arrays de datos
 * @param {Array} x - Primer conjunto de datos
 * @param {Array} y - Segundo conjunto de datos
 * @returns {number} Coeficiente de correlación (-1 a 1)
 */
function calculateCorrelation(x, y) {
    // Filtrar valores nulos y asegurar que ambos arrays tengan la misma longitud
    const validPairs = [];
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
        if (x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])) {
            validPairs.push([x[i], y[i]]);
        }
    }
    
    if (validPairs.length < 2) return 0;
    
    const xValues = validPairs.map(pair => pair[0]);
    const yValues = validPairs.map(pair => pair[1]);
    
    const n = validPairs.length;
    const sumX = xValues.reduce((sum, val) => sum + val, 0);
    const sumY = yValues.reduce((sum, val) => sum + val, 0);
    const sumXY = validPairs.reduce((sum, pair) => sum + (pair[0] * pair[1]), 0);
    const sumX2 = xValues.reduce((sum, val) => sum + (val * val), 0);
    const sumY2 = yValues.reduce((sum, val) => sum + (val * val), 0);
    
    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
    
    if (denominator === 0) return 0;
    
    return numerator / denominator;
}

/**
 * Crea la matriz de correlaciones entre variables meteorológicas
 * @param {Object} weatherData - Datos meteorológicos
 * @returns {Object} Matriz de correlaciones y variables
 */
function createCorrelationMatrix(weatherData) {
    const variables = [
        { key: 'temperature_2m', label: 'Temperatura' },
        { key: 'relativehumidity_2m', label: 'Humedad' },
        { key: 'surface_pressure', label: 'Presión' },
        { key: 'windspeed_10m', label: 'Viento' },
        { key: 'windgusts_10m', label: 'Ráfagas' },
        { key: 'dewpoint_2m', label: 'Pto. Rocío' },
        { key: 'rain', label: 'Lluvia' }
    ];
    
    // Calcular matriz de correlaciones
    const correlationMatrix = [];
    variables.forEach((varX, i) => {
        variables.forEach((varY, j) => {
            const correlation = calculateCorrelation(
                weatherData[varX.key] || [],
                weatherData[varY.key] || []
            );
            
            correlationMatrix.push({
                x: varX.label,
                y: varY.label,
                correlation: correlation
            });
        });
    });
    
    return { matrix: correlationMatrix, variables };
}

/**
 * Crea el gráfico de matriz de correlaciones
 * @param {Object} weatherData - Datos meteorológicos
 */
function createCorrelationChart(weatherData) {
    const { matrix, variables } = createCorrelationMatrix(weatherData);
    
    // Preparar datos para ApexCharts heatmap
    const series = variables.map(varY => ({
        name: varY.label,
        data: variables.map(varX => {
            const correlation = matrix.find(m => m.x === varX.label && m.y === varY.label)?.correlation || 0;
            return {
                x: varX.label,
                y: correlation
            };
        })
    }));

    const options = {
        series: series,
        chart: {
            height: 500,
            type: 'heatmap',
            toolbar: {
                show: true
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val) {
                return val.toFixed(2);
            },
            style: {
                fontSize: '12px',
                fontWeight: 600
            }
        },
        colors: ['#FF6B6B'],
        colorScale: {
            ranges: [
                { from: -1, to: -0.7, color: '#4299E1', name: 'Fuerte Negativa' },
                { from: -0.7, to: -0.3, color: '#63B3ED', name: 'Moderada Negativa' },
                { from: -0.3, to: 0.3, color: '#F7FAFC', name: 'Débil' },
                { from: 0.3, to: 0.7, color: '#FBD38D', name: 'Moderada Positiva' },
                { from: 0.7, to: 1, color: '#F56565', name: 'Fuerte Positiva' }
            ]
        },
        title: {
            text: 'Coeficientes de Correlación de Pearson',
            align: 'center',
            style: {
                fontSize: '16px',
                fontWeight: 600
            }
        },
        xaxis: {
            title: {
                text: 'Variables Meteorológicas'
            },
            labels: {
                rotate: -45
            }
        },
        yaxis: {
            title: {
                text: 'Variables Meteorológicas'
            }
        },
        tooltip: {
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const xVar = w.globals.labels[dataPointIndex];
                const yVar = w.config.series[seriesIndex].name;
                const correlation = series[seriesIndex][dataPointIndex];
                
                let strength = '';
                let interpretation = '';
                
                if (Math.abs(correlation) >= 0.7) {
                    strength = 'Fuerte';
                    interpretation = 'Las variables están muy relacionadas';
                } else if (Math.abs(correlation) >= 0.3) {
                    strength = 'Moderada';
                    interpretation = 'Las variables tienen relación significativa';
                } else {
                    strength = 'Débil';
                    interpretation = 'Las variables tienen poca relación';
                }
                
                const direction = correlation > 0 ? 'Positiva' : 'Negativa';
                
                return `
                    <div style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <div style="font-weight: 600; margin-bottom: 8px;">${yVar} vs ${xVar}</div>
                        <div style="margin-bottom: 4px;"><strong>Correlación:</strong> ${correlation.toFixed(3)}</div>
                        <div style="margin-bottom: 4px;"><strong>Fuerza:</strong> ${strength} ${direction}</div>
                        <div style="font-size: 12px; color: #666;">${interpretation}</div>
                    </div>
                `;
            }
        },
        legend: {
            show: false
        }
    };

    const chart = new ApexCharts(document.querySelector('#correlationChart'), options);
    chart.render();
    chartInstances.push(chart);
    
    // Generar insights
    generateCorrelationInsights(matrix);
}

/**
 * Alterna la visibilidad del panel de información de alertas
 */
function toggleAlertInfo() {
    const alertInfo = document.getElementById('alertInfo');
    if (alertInfo.style.display === 'none' || alertInfo.style.display === '') {
        alertInfo.style.display = 'block';
    } else {
        alertInfo.style.display = 'none';
    }
}

/**
 * Genera insights basados en las correlaciones calculadas
 * @param {Array} matrix - Matriz de correlaciones
 */
function generateCorrelationInsights(matrix) {
    const insights = [];
    
    // Encontrar correlaciones más fuertes (excluyendo diagonal)
    const significantCorrelations = matrix
        .filter(m => m.x !== m.y) // Excluir correlaciones de variable consigo misma
        .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
        .slice(0, 8); // Top 8 correlaciones
    
    significantCorrelations.forEach(corr => {
        let category = '';
        let interpretation = '';
        
        if (Math.abs(corr.correlation) >= 0.7) {
            category = 'strong';
            interpretation = 'Relación muy fuerte que indica dependencia directa';
        } else if (Math.abs(corr.correlation) >= 0.4) {
            category = 'moderate';
            interpretation = 'Relación significativa que sugiere influencia mutua';
        } else if (Math.abs(corr.correlation) >= 0.2) {
            category = 'weak';
            interpretation = 'Relación débil pero detectable';
        }
        
        if (category) {
            const direction = corr.correlation > 0 ? 'positiva' : 'negativa';
            insights.push({
                title: `${corr.x} ↔ ${corr.y}`,
                value: `r = ${corr.correlation.toFixed(3)} (${direction})`,
                description: interpretation,
                category: category
            });
        }
    });
    
    // Mostrar insights
    const container = document.getElementById('correlationInsights');
    container.innerHTML = '';
    
    if (insights.length === 0) {
        container.innerHTML = '<div class="no-alerts">No se encontraron correlaciones significativas</div>';
        return;
    }
    
    insights.forEach(insight => {
        const insightElement = document.createElement('div');
        insightElement.className = `insight-item insight-${insight.category}`;
        insightElement.innerHTML = `
            <div class="insight-title">${insight.title}</div>
            <div class="insight-value">${insight.value}</div>
            <div class="insight-description">${insight.description}</div>
        `;
        container.appendChild(insightElement);
    });
}

/**
 * Cambia entre pestañas de análisis
 * @param {string} tabName - Nombre de la pestaña a activar
 */
function switchTab(tabName) {
    // Remover clase active de todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Ocultar todos los paneles
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Activar el botón y panel correspondiente
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

/**
 * Calcula estadísticas descriptivas de un conjunto de datos
 * @param {Array} data - Array de valores numéricos
 * @returns {Object|null} Estadísticas calculadas o null si no hay datos válidos
 */
function calculateStats(data) {
    const validData = data.filter(d => d !== null && d !== undefined && !isNaN(d));
    if (validData.length === 0) return null;
    
    const sorted = [...validData].sort((a, b) => a - b);
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    const avg = validData.reduce((sum, val) => sum + val, 0) / validData.length;
    
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const median = sorted.length % 2 === 0 
        ? (sorted[Math.floor(sorted.length / 2) - 1] + sorted[Math.floor(sorted.length / 2)]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    
    const variance = validData.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / validData.length;
    const stdDev = Math.sqrt(variance);
    
    return { min, max, avg, median, stdDev, q1: sorted[q1Index], q3: sorted[q3Index] };
}

/**
 * Analiza los datos meteorológicos para detectar alertas
 * @param {Object} weatherData - Datos meteorológicos
 * @returns {Array} Lista de alertas detectadas
 */
function analyzeAlerts(weatherData) {
    const alerts = [];
    
    // Temperatura extrema
    const temps = weatherData.temperature_2m.filter(t => t !== null);
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    
    if (maxTemp > 30) {
        alerts.push({ level: 'high', icon: '🔥', message: `Temperatura alta: ${maxTemp.toFixed(1)}°C` });
    }
    if (minTemp < 0) {
        alerts.push({ level: 'high', icon: '❄️', message: `Riesgo de helada: ${minTemp.toFixed(1)}°C` });
    }
    
    // Vientos fuertes
    const winds = weatherData.windgusts_10m.filter(w => w !== null);
    const maxWind = Math.max(...winds);
    if (maxWind > 50) {
        alerts.push({ level: 'high', icon: '💨', message: `Vientos peligrosos: ${maxWind.toFixed(1)} km/h` });
    } else if (maxWind > 30) {
        alerts.push({ level: 'medium', icon: '🌬️', message: `Vientos moderados: ${maxWind.toFixed(1)} km/h` });
    }
    
    // Precipitación intensa
    const rains = weatherData.rain.filter(r => r !== null && r > 0);
    const maxRain = rains.length > 0 ? Math.max(...rains) : 0;
    if (maxRain > 10) {
        alerts.push({ level: 'medium', icon: '🌧️', message: `Lluvia intensa: ${maxRain.toFixed(1)} mm/h` });
    }
    
    // Cambios bruscos de presión
    const pressures = weatherData.surface_pressure.filter(p => p !== null);
    if (pressures.length > 1) {
        const pressureChange = Math.abs(Math.max(...pressures) - Math.min(...pressures));
        if (pressureChange > 10) {
            alerts.push({ level: 'medium', icon: '⚡', message: `Cambio brusco de presión: ${pressureChange.toFixed(1)} hPa` });
        }
    }
    
    // Condiciones de alta humedad
    const humidity = weatherData.relativehumidity_2m.filter(h => h !== null);
    const avgHumidity = humidity.reduce((sum, h) => sum + h, 0) / humidity.length;
    if (avgHumidity > 90) {
        alerts.push({ level: 'low', icon: '💧', message: `Humedad alta promedio: ${avgHumidity.toFixed(1)}%` });
    }
    
    return alerts;
}

/**
 * Analiza patrones meteorológicos en los datos
 * @param {Object} weatherData - Datos meteorológicos
 * @param {string} dataType - Tipo de datos: 'historical' o 'forecast'
 * @returns {Array} Lista de patrones detectados
 */
function analyzePatterns(weatherData, dataType) {
    const patterns = [];
    
    // Tendencia de temperatura
    const temps = weatherData.temperature_2m.filter(t => t !== null);
    const tempTrend = temps[temps.length - 1] - temps[0];
    const trendLabel = dataType === 'forecast' ? 'Tendencia Esperada (7 días)' : 'Tendencia de Temperatura (48h)';
    patterns.push({
        title: trendLabel,
        value: tempTrend > 0 ? `Ascendente +${tempTrend.toFixed(1)}°C` : `Descendente ${tempTrend.toFixed(1)}°C`
    });
    
    // Acumulado de precipitación
    const totalRain = weatherData.rain.filter(r => r !== null).reduce((sum, r) => sum + r, 0);
    const totalSnow = weatherData.snowfall.filter(s => s !== null).reduce((sum, s) => sum + s, 0);
    const precipLabel = dataType === 'forecast' ? 'Precipitación Esperada' : 'Precipitación Acumulada';
    patterns.push({
        title: precipLabel,
        value: `Lluvia: ${totalRain.toFixed(1)}mm | Nieve: ${totalSnow.toFixed(1)}cm`
    });
    
    // Rango de vientos
    const winds = weatherData.windspeed_10m.filter(w => w !== null);
    const windRange = Math.max(...winds) - Math.min(...winds);
    patterns.push({
        title: 'Variabilidad del Viento',
        value: `Rango: ${windRange.toFixed(1)} km/h (${Math.min(...winds).toFixed(1)} - ${Math.max(...winds).toFixed(1)})`
    });
    
    // Estabilidad de presión
    const pressures = weatherData.surface_pressure.filter(p => p !== null);
    const pressureStdDev = calculateStats(pressures)?.stdDev || 0;
    const stabilityLabel = dataType === 'forecast' ? 'Estabilidad Atmosférica Esperada' : 'Estabilidad Atmosférica';
    patterns.push({
        title: stabilityLabel,
        value: pressureStdDev < 2 ? 'Estable' : pressureStdDev < 5 ? 'Moderadamente variable' : 'Muy variable'
    });
    
    return patterns;
}

/**
 * Crea el panel de estadísticas principales
 * @param {Object} weatherData - Datos meteorológicos
 */
function createStatsPanel(weatherData) {
    const statsContainer = document.getElementById('statsPanel');
    statsContainer.innerHTML = '';
    
    const variables = [
        { key: 'temperature_2m', label: 'Temperatura', unit: '°C' },
        { key: 'relativehumidity_2m', label: 'Humedad', unit: '%' },
        { key: 'windspeed_10m', label: 'Viento', unit: 'km/h' },
        { key: 'surface_pressure', label: 'Presión', unit: 'hPa' }
    ];
    
    variables.forEach(variable => {
        const stats = calculateStats(weatherData[variable.key]);
        if (stats) {
            const statCard = document.createElement('div');
            statCard.className = 'stat-card';
            statCard.innerHTML = `
                <div class="stat-value">${stats.avg.toFixed(1)}<span class="stat-unit">${variable.unit}</span></div>
                <div class="stat-label">${variable.label} Promedio</div>
                <div style="font-size: 0.75rem; color: #a0aec0; margin-top: 0.5rem;">
                    Min: ${stats.min.toFixed(1)} | Max: ${stats.max.toFixed(1)}
                </div>
            `;
            statsContainer.appendChild(statCard);
        }
    });
}

/**
 * Crea el panel de alertas meteorológicas
 * @param {Array} alerts - Lista de alertas detectadas
 */
function createAlertsPanel(alerts) {
    const alertsList = document.getElementById('alertsList');
    alertsList.innerHTML = '';
    
    if (alerts.length === 0) {
        alertsList.innerHTML = '<div class="no-alerts">✅ No hay alertas meteorológicas</div>';
        return;
    }
    
    alerts.forEach(alert => {
        const alertItem = document.createElement('div');
        alertItem.className = `alert-item alert-${alert.level}`;
        alertItem.innerHTML = `
            <span class="alert-icon">${alert.icon}</span>
            <span>${alert.message}</span>
        `;
        alertsList.appendChild(alertItem);
    });
}

/**
 * Crea el panel de análisis de patrones
 * @param {Array} patterns - Lista de patrones detectados
 */
function createPatternsPanel(patterns) {
    const patternsList = document.getElementById('patternsList');
    patternsList.innerHTML = '';
    
    patterns.forEach(pattern => {
        const patternItem = document.createElement('div');
        patternItem.className = 'pattern-item';
        patternItem.innerHTML = `
            <div class="pattern-title">${pattern.title}</div>
            <div class="pattern-value">${pattern.value}</div>
        `;
        patternsList.appendChild(patternItem);
    });
}

/**
 * Crea el resumen ejecutivo con información meteorológica
 * @param {Object} weatherData - Datos meteorológicos
 * @param {Array} alerts - Lista de alertas detectadas
 * @param {Object} dateRange - Rango de fechas del análisis
 * @param {Object} coordinates - Coordenadas de la ubicación
 * @param {string} dataType - Tipo de datos: 'historical' o 'forecast'
 */
function createExecutiveSummary(weatherData, alerts, dateRange, coordinates, dataType) {
    const summaryContainer = document.getElementById('executiveSummary');
    
    const tempStats = calculateStats(weatherData.temperature_2m);
    const totalRain = weatherData.rain.filter(r => r !== null).reduce((sum, r) => sum + r, 0);
    const maxWind = Math.max(...weatherData.windgusts_10m.filter(w => w !== null));
    
    const alertLevel = alerts.some(a => a.level === 'high') ? 'ALTO' : 
                     alerts.some(a => a.level === 'medium') ? 'MEDIO' : 'BAJO';
    
    let periodText = '';
    let titleText = '';
    
    if (dataType === 'forecast') {
        titleText = '🔮 Pronóstico Meteorológico';
        periodText = `Pronóstico para los próximos 7 días desde ${dateRange.start} hasta ${dateRange.end} en la coordenada [${coordinates.lat}, ${coordinates.long}]`;
    } else {
        titleText = '📋 Resumen Ejecutivo';
        periodText = `Desde las 00:00 horas del ${dateRange.start} hasta las 23:59 horas del ${dateRange.end} en la coordenada [${coordinates.lat}, ${coordinates.long}]`;
    }
    
    summaryContainer.innerHTML = `
        <div class="summary-title">${titleText}</div>
        <div class="summary-subtitle">
            ${periodText}
        </div>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value">${tempStats?.avg.toFixed(1) || 'N/A'}°C</div>
                <div class="summary-label">Temp. Promedio</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${totalRain.toFixed(1)}mm</div>
                <div class="summary-label">${dataType === 'forecast' ? 'Lluvia Esperada' : 'Lluvia Total'}</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${maxWind.toFixed(0)} km/h</div>
                <div class="summary-label">${dataType === 'forecast' ? 'Viento Máximo Esperado' : 'Viento Máximo'}</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${alertLevel}</div>
                <div class="summary-label">Nivel de Riesgo</div>
            </div>
        </div>
    `;
}

/**
 * Crea el gráfico combinado de temperatura, humedad y presión
 * @param {Object} weatherData - Datos meteorológicos
 * @param {Array} timestamps - Array de timestamps
 */
function createCombinedChart(weatherData, timestamps) {
    const formattedTimestamps = timestamps.map(formatDateTime);
    
    const tempData = weatherData.temperature_2m.map((value, index) => ({
        x: formattedTimestamps[index],
        y: value
    }));
    
    const humidityData = weatherData.relativehumidity_2m.map((value, index) => ({
        x: formattedTimestamps[index],
        y: value
    }));
    
    const pressureData = weatherData.surface_pressure.map((value, index) => ({
        x: formattedTimestamps[index],
        y: value
    }));

    const options = {
        series: [
            {
                name: 'Temperatura (°C)',
                type: 'line',
                data: tempData,
                yAxisIndex: 0
            },
            {
                name: 'Humedad (%)',
                type: 'line',
                data: humidityData,
                yAxisIndex: 1
            },
            {
                name: 'Presión (hPa)',
                type: 'line',
                data: pressureData,
                yAxisIndex: 2
            }
        ],
        chart: {
            height: 400,
            type: 'line',
            toolbar: {
                show: true
            }
        },
        colors: ['#FF6B6B', '#6BCF7F', '#4D96FF'],
        stroke: {
            width: [3, 2, 2],
            curve: 'smooth'
        },
        xaxis: {
            type: 'category',
            labels: {
                rotate: -45,
                style: {
                    fontSize: '10px'
                }
            }
        },
        yaxis: [
            {
                title: {
                    text: 'Temperatura (°C)',
                    style: { color: '#FF6B6B' }
                },
                labels: {
                    style: { colors: '#FF6B6B' }
                }
            },
            {
                opposite: true,
                title: {
                    text: 'Humedad (%)',
                    style: { color: '#6BCF7F' }
                },
                labels: {
                    style: { colors: '#6BCF7F' }
                }
            },
            {
                opposite: true,
                title: {
                    text: 'Presión (hPa)',
                    style: { color: '#4D96FF' }
                },
                labels: {
                    style: { colors: '#4D96FF' }
                }
            }
        ],
        tooltip: {
            shared: true,
            intersect: false
        },
        legend: {
            position: 'top'
        }
    };

    const chart = new ApexCharts(document.querySelector('#combinedChart'), options);
    chart.render();
    chartInstances.push(chart);
}

/**
 * Crea un gráfico individual para una variable meteorológica
 * @param {string} containerId - ID del contenedor donde crear el gráfico
 * @param {string} variableKey - Clave de la variable meteorológica
 * @param {Array} data - Datos de la variable
 * @param {Array} timestamps - Array de timestamps
 */
function createChart(containerId, variableKey, data, timestamps) {
    const config = WEATHER_VARIABLES[variableKey];
    
    const chartContainer = document.createElement("div");
    chartContainer.className = "chart-card";
    chartContainer.innerHTML = `
        <div class="chart-title">${config.label} (${config.unit})</div>
        <div id="chart-${variableKey}" style="height: 350px;"></div>
    `;
    
    document.getElementById(containerId).appendChild(chartContainer);

    const formattedTimestamps = timestamps.map(formatDateTime);

    // Preparar datos en formato correcto para ApexCharts
    const chartData = data.map((value, index) => ({
        x: formattedTimestamps[index],
        y: value !== null ? Number(value) : 0
    }));

    const options = {
        series: [{
            name: config.label,
            data: chartData
        }],
        chart: {
            type: 'bar',
            height: 350,
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 600
            }
        },
        colors: [config.color],
        plotOptions: {
            bar: {
                columnWidth: '70%',
                borderRadius: 2,
                distributed: false
            }
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            type: 'category',
            title: {
                text: 'Fecha y Hora',
                style: {
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#333'
                }
            },
            labels: {
                rotate: -45,
                style: {
                    fontSize: '10px',
                    colors: '#666'
                },
                maxHeight: 60
            }
        },
        yaxis: {
            title: {
                text: config.unit,
                style: {
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#333'
                }
            },
            labels: {
                style: {
                    fontSize: '11px',
                    colors: '#666'
                },
                formatter: function(value) {
                    return value !== null ? value.toFixed(1) : '0';
                }
            }
        },
        tooltip: {
            theme: 'light',
            y: {
                formatter: function(value) {
                    return `${value !== null ? value.toFixed(2) : '0'} ${config.unit}`;
                }
            }
        },
        grid: {
            borderColor: '#e7e7e7',
            strokeDashArray: 3,
            row: {
                colors: ['#f8f9fa', 'transparent'],
                opacity: 0.5
            }
        },
        theme: {
            mode: 'light'
        },
        responsive: [{
            breakpoint: 768,
            options: {
                chart: {
                    height: 280
                },
                xaxis: {
                    labels: {
                        rotate: -90,
                        style: {
                            fontSize: '9px'
                        }
                    }
                }
            }
        }]
    };

    try {
        const chart = new ApexCharts(document.querySelector(`#chart-${variableKey}`), options);
        chart.render();
        chartInstances.push(chart);
    } catch (error) {
        console.error(`Error creating chart for ${variableKey}:`, error);
    }
}

/**
 * Pobla el selector de ubicaciones con las coordenadas disponibles
 */
function populateLocationSelect() {
    const select = document.getElementById("locationSelect");
    coordinates.forEach(coord => {
        const option = document.createElement("option");
        option.value = coord.id;
        option.textContent = `Punto ${coord.id}`;
        select.appendChild(option);
    });
}

/**
 * Maneja el cambio en el tipo de datos (histórico/pronóstico)
 */
function handleDataTypeChange() {
    const dataType = document.getElementById("dataType").value;
    const dateGroup = document.getElementById("dateGroup");
    const endDateInput = document.getElementById("endDate");
    
    if (dataType === "forecast") {
        dateGroup.style.display = "none";
        endDateInput.removeAttribute("required");
    } else {
        dateGroup.style.display = "block";
        endDateInput.setAttribute("required", "true");
    }
}

/**
 * Calcula el rango de fechas para datos históricos
 * @param {string} endDateStr - Fecha final en formato YYYY-MM-DD
 * @returns {Object} Objeto con fechas de inicio y fin
 */
function calculateHistoricalDateRange(endDateStr) {
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59);
    const start = new Date(end.getTime() - 47 * 60 * 60 * 1000);
    return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0]
    };
}

/**
 * Calcula el rango de fechas para pronóstico (próximos 7 días)
 * @returns {Object} Objeto con fechas de inicio y fin del pronóstico
 */
function calculateForecastDateRange() {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 6);
    return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0]
    };
}

/**
 * Formatea una fecha y hora para mostrar en los gráficos
 * @param {string} timeStr - String de fecha/hora
 * @returns {string} Fecha formateada
 */
function formatDateTime(timeStr) {
    const date = new Date(timeStr);
    return date.toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/**
 * Limpia todos los gráficos existentes
 */
function clearCharts() {
    chartInstances.forEach(chart => chart.destroy());
    chartInstances = [];
    document.getElementById("chartsContainer").innerHTML = "";
    document.getElementById('analysisContainer').style.display = 'none';
}

/**
 * Muestra un mensaje de error al usuario
 * @param {string} message - Mensaje de error a mostrar
 */
function showError(message) {
    const errorElement = document.getElementById("error");
    errorElement.textContent = message;
    errorElement.style.display = "block";
    setTimeout(() => {
        errorElement.style.display = "none";
    }, 5000);
}

/**
 * Controla la visibilidad del indicador de carga
 * @param {boolean} isLoading - Si está cargando o no
 */
function toggleLoading(isLoading) {
    document.getElementById("loading").style.display = isLoading ? "block" : "none";
    document.getElementById("submitBtn").disabled = isLoading;
}

/**
 * Obtiene datos meteorológicos históricos desde la API de Open-Meteo
 * @param {number} lat - Latitud de la ubicación
 * @param {number} lon - Longitud de la ubicación  
 * @param {string} startDate - Fecha de inicio en formato YYYY-MM-DD
 * @param {string} endDate - Fecha de fin en formato YYYY-MM-DD
 * @returns {Promise<Object>} Datos meteorológicos históricos
 */
async function fetchHistoricalWeatherData(lat, lon, startDate, endDate) {
    const hourlyVars = [
        'temperature_2m',
        'rain', 
        'snowfall',
        'windspeed_10m',
        'windgusts_10m',
        'relativehumidity_2m',
        'surface_pressure',
        'dewpoint_2m'
    ].join(",");
    
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=${hourlyVars}&timezone=auto`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error en la API: ${response.status}`);
    }
    
    return response.json();
}

/**
 * Obtiene datos de pronóstico meteorológico desde la API de Open-Meteo
 * @param {number} lat - Latitud de la ubicación
 * @param {number} lon - Longitud de la ubicación
 * @returns {Promise<Object>} Datos de pronóstico meteorológico
 */
async function fetchForecastWeatherData(lat, lon) {
    const hourlyVars = [
        'temperature_2m',
        'rain', 
        'snowfall',
        'windspeed_10m',
        'windgusts_10m',
        'relativehumidity_2m',
        'surface_pressure',
        'dewpoint_2m'
    ].join(",");
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}&timezone=auto&forecast_days=7`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error en la API: ${response.status}`);
    }
    
    return response.json();
}

// FUNCIÓN PRINCIPAL DE CONSULTA
/**
 * Ejecuta la consulta meteorológica principal
 * Esta función determina qué API usar basándose en el valor del campo dataType:
 * - "historical": Usa fetchHistoricalWeatherData() con archive-api.open-meteo.com
 * - "forecast": Usa fetchForecastWeatherData() con api.open-meteo.com
 */
async function executeQuery() {
    const selectedLocation = document.getElementById("locationSelect").value;
    const dataType = document.getElementById("dataType").value;
    const endDate = document.getElementById("endDate").value;

    if (!selectedLocation) {
        showError("Por favor selecciona una ubicación.");
        return;
    }

    // Para pronóstico, no necesitamos fecha
    if (dataType === "historical" && !endDate) {
        showError("Por favor selecciona una fecha para datos históricos.");
        return;
    }

    const coord = coordinates.find(c => c.id === selectedLocation);
    if (!coord) {
        showError("Ubicación no válida.");
        return;
    }

    clearCharts();
    toggleLoading(true);

    try {
        let weatherData;
        let dateRange;
        
        // AQUÍ ES DONDE SE DECIDE QUÉ API USAR
        if (dataType === "forecast") {
            // USAR API DE PRONÓSTICO
            weatherData = await fetchForecastWeatherData(coord.lat, coord.long);
            dateRange = calculateForecastDateRange();
        } else {
            // USAR API HISTÓRICA
            const { start, end } = calculateHistoricalDateRange(endDate);
            weatherData = await fetchHistoricalWeatherData(coord.lat, coord.long, start, end);
            dateRange = { start, end };
        }
        
        if (!weatherData.hourly || !weatherData.hourly.time) {
            throw new Error("Datos meteorológicos no disponibles");
        }

        const timestamps = weatherData.hourly.time;

        // Mostrar container de análisis
        document.getElementById('analysisContainer').style.display = 'block';

        // Crear análisis avanzados
        const alerts = analyzeAlerts(weatherData.hourly);
        const patterns = analyzePatterns(weatherData.hourly, dataType);
        
        // Preparar información de fechas y coordenadas
        const coordinatesInfo = { lat: coord.lat, long: coord.long };
        
        // Generar paneles de análisis
        createExecutiveSummary(weatherData.hourly, alerts, dateRange, coordinatesInfo, dataType);
        createStatsPanel(weatherData.hourly);
        createAlertsPanel(alerts);
        createPatternsPanel(patterns);
        createCombinedChart(weatherData.hourly, timestamps);
        createCorrelationChart(weatherData.hourly);

        // Crear gráficos en el orden especificado
        const variableOrder = [
            'temperature_2m',
            'rain', 
            'snowfall',
            'windspeed_10m',
            'windgusts_10m',
            'relativehumidity_2m',
            'surface_pressure',
            'dewpoint_2m'
        ];

        variableOrder.forEach(variable => {
            if (weatherData.hourly[variable]) {
                createChart("chartsContainer", variable, weatherData.hourly[variable], timestamps);
            }
        });

    } catch (error) {
        console.error("Error:", error);
        showError(`Error al obtener los datos: ${error.message}`);
        document.getElementById('analysisContainer').style.display = 'none';
    } finally {
        toggleLoading(false);
    }
}

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
    // Poblar selector de ubicaciones
    populateLocationSelect();
    
    // Event listeners
    document.getElementById("dataType").addEventListener("change", handleDataTypeChange);
    
    document.getElementById("weatherForm").addEventListener("submit", (event) => {
        event.preventDefault();
        executeQuery();
    });

    // Event listeners para botones de pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Configuración inicial del formulario
    handleDataTypeChange();

    // Establecer fecha límite para datos históricos (hoy - 5 días)
    const today = new Date();
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() - 5);
    
    const endDateInput = document.getElementById("endDate");
    endDateInput.max = limitDate.toISOString().split("T")[0];
    endDateInput.value = limitDate.toISOString().split("T")[0];
});