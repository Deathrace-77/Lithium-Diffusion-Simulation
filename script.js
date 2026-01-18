// Simulation state
let isRunning = false;
let currentIndex = 0;
let animationFrame = null;
let mainChart = null;
let animationCanvas = null;
let animationCtx = null;

// User settings
let maxParticleSize = 1000; // nm
let minParticleSize = 1; // nm
let baselineSize = 10000; // nm (10 µm)
let currentDiffusionCoeff = 1e-14; // m²/s
let currentChartType = 'diffusion';

// Data arrays
let radii = [];
let diffusionData = {
    labels: [],
    times: []
};
let improvementData = {
    labels: [],
    improvement: []
};

// Animation particles
let baselineParticle = { x: 0, y: 0, radius: 0, progress: 0, color: '#ef4444', speed: 0 };
let currentParticle = { x: 0, y: 0, radius: 0, progress: 0, color: '#10b981', speed: 0 };

// Generate logarithmic particle radii
function generateRadii() {
    const result = [];
    const minLog = Math.log10(minParticleSize);
    const maxLog = Math.log10(maxParticleSize);
    const steps = 100;
    
    for (let i = 0; i <= steps; i++) {
        const logValue = minLog + (maxLog - minLog) * (i / steps);
        result.push(Math.pow(10, logValue));
    }
    return result;
}

// Calculate diffusion time: t = L²/D
function calculateDiffusionTime(radiusNm, D) {
    const radiusM = radiusNm * 1e-9; // Convert nm to m
    return (radiusM * radiusM) / D;
}

// Format time for display
function formatTime(seconds) {
    if (seconds < 0.001) return `${(seconds * 1e6).toFixed(2)} µs`;
    if (seconds < 1) return `${(seconds * 1000).toFixed(2)} ms`;
    if (seconds < 60) return `${seconds.toFixed(2)} s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(2)} min`;
    return `${(seconds / 3600).toFixed(2)} hr`;
}

// Calculate particle visual properties based on diffusion time
function updateParticleProperties() {
    const baselineTime = calculateDiffusionTime(baselineSize, currentDiffusionCoeff);
    const currentRadius = radii[Math.min(currentIndex, radii.length - 1)] || minParticleSize;
    const currentTime = calculateDiffusionTime(currentRadius, currentDiffusionCoeff);
    
    // Scale particle sizes for visualization (relative to canvas)
    const maxVisualRadius = 60;
    const minVisualRadius = 10;
    
    // Baseline particle - always relatively large
    baselineParticle.radius = maxVisualRadius * 0.8;
    baselineParticle.speed = 0.003; // Slow
    
    // Current particle - scales with actual size
    const sizeRatio = currentRadius / baselineSize;
    currentParticle.radius = Math.max(minVisualRadius, maxVisualRadius * sizeRatio * 2);
    
    // Speed inversely proportional to diffusion time
    const timeRatio = baselineTime / currentTime;
    currentParticle.speed = 0.003 * Math.sqrt(timeRatio);
}

// Initialize animation canvas
function initAnimationCanvas() {
    animationCanvas = document.getElementById('animationCanvas');
    animationCtx = animationCanvas.getContext('2d');
    
    // Set canvas size
    const container = animationCanvas.parentElement;
    animationCanvas.width = container.clientWidth - 32;
    animationCanvas.height = 400;
    
    // Initialize particles
    baselineParticle.x = animationCanvas.width * 0.25;
    baselineParticle.y = animationCanvas.height / 2;
    
    currentParticle.x = animationCanvas.width * 0.75;
    currentParticle.y = animationCanvas.height / 2;
    
    updateParticleProperties();
    drawAnimation();
}

// Draw animation frame
function drawAnimation() {
    if (!animationCtx) return;
    
    const ctx = animationCtx;
    const width = animationCanvas.width;
    const height = animationCanvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
    }
    for (let i = 0; i < height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
    }
    
    // Draw particles
    drawParticle(baselineParticle, `Baseline (${(baselineSize/1000).toFixed(1)} µm)`);
    drawParticle(currentParticle, `Current (${(radii[Math.min(currentIndex, radii.length - 1)] || minParticleSize).toFixed(1)} nm)`);
}

function drawParticle(particle, label) {
    const ctx = animationCtx;
    
    // Draw particle circle
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw diffusion waves
    if (isRunning) {
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const waveRadius = particle.radius + particle.progress * 100 + i * 30;
            ctx.arc(particle.x, particle.y, waveRadius, 0, Math.PI * 2);
            ctx.strokeStyle = particle.color;
            ctx.globalAlpha = Math.max(0, 0.5 - particle.progress - i * 0.15);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
    
    // Draw label
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, particle.x, particle.y - particle.radius - 20);
}

// Update animation
function updateAnimation() {
    if (!isRunning) return;
    
    // Update progress based on particle-specific speeds
    baselineParticle.progress += baselineParticle.speed;
    currentParticle.progress += currentParticle.speed;
    
    if (baselineParticle.progress > 1) baselineParticle.progress = 0;
    if (currentParticle.progress > 1) currentParticle.progress = 0;
    
    drawAnimation();
}

// Initialize chart
function initChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: 'Particle Radius (nm)',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                y: {
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: '',
                        font: { size: 14, weight: 'bold' }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (currentChartType === 'diffusion') {
                                return 'Diffusion Time: ' + formatTime(context.parsed.y);
                            }
                            return 'Improvement: ' + context.parsed.y.toFixed(2) + 'x';
                        }
                    }
                }
            },
            animation: {
                duration: 0
            }
        }
    });
    
    updateChartType();
}

// Update chart based on selected type
function updateChartType() {
    if (!mainChart) return;
    
    if (currentChartType === 'diffusion') {
        mainChart.data.labels = diffusionData.labels;
        mainChart.data.datasets = [
            {
                label: `Diffusion Time (D = ${currentDiffusionCoeff.toExponential(0)} m²/s)`,
                data: diffusionData.times,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4
            }
        ];
        mainChart.options.scales.y.title.text = 'Diffusion Time (s)';
    } else {
        mainChart.data.labels = improvementData.labels;
        mainChart.data.datasets = [
            {
                label: `Improvement vs ${(baselineSize/1000).toFixed(1)} µm Baseline`,
                data: improvementData.improvement,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 3,
                pointRadius: 0,
                tension: 0.4
            }
        ];
        mainChart.options.scales.y.title.text = 'Improvement Factor';
    }
    
    mainChart.update('none');
}

// Update stats display
function updateStats() {
    if (currentIndex < radii.length && diffusionData.labels.length > 0) {
        const currentRadiusNm = radii[currentIndex] || radii[radii.length - 1];
        const lastIndex = diffusionData.labels.length - 1;
        const time = diffusionData.times[lastIndex];
        const improvement = improvementData.improvement[lastIndex];
        
        document.getElementById('currentSize').textContent = currentRadiusNm.toFixed(2) + ' nm';
        document.getElementById('diffusionTime').textContent = formatTime(time);
        document.getElementById('improvementFactor').textContent = improvement.toFixed(2) + 'x';
    }
    
    document.getElementById('dataCount').textContent = diffusionData.labels.length;
}

// Animation loop
function animate() {
    if (!isRunning || currentIndex >= radii.length) {
        isRunning = false;
        updateUI();
        return;
    }

    const radius = radii[currentIndex];

    // Calculate diffusion time
    const time = calculateDiffusionTime(radius, currentDiffusionCoeff);

    // Calculate improvement factor
    const baselineTime = calculateDiffusionTime(baselineSize, currentDiffusionCoeff);
    const improvementFactor = baselineTime / time;

    // Add data points
    diffusionData.labels.push(radius);
    diffusionData.times.push(time);

    improvementData.labels.push(radius);
    improvementData.improvement.push(improvementFactor);

    // Update displays
    if (currentIndex % 3 === 0 || currentIndex === radii.length - 1) {
        updateChartType();
        updateStats();
        updateParticleProperties();
    }
    
    updateAnimation();

    currentIndex++;
    animationFrame = requestAnimationFrame(animate);
}

// Toggle simulation
function toggleSimulation() {
    if (!radii.length) {
        radii = generateRadii();
    }

    isRunning = !isRunning;
    
    if (isRunning) {
        animate();
    } else {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    }
    
    updateUI();
}

// Reset simulation
function resetSimulation() {
    isRunning = false;
    currentIndex = 0;
    
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    // Clear data
    diffusionData = {
        labels: [],
        times: []
    };
    improvementData = {
        labels: [],
        improvement: []
    };

    radii = generateRadii();
    baselineParticle.progress = 0;
    currentParticle.progress = 0;
    
    updateParticleProperties();
    updateChartType();
    updateStats();
    drawAnimation();
    updateUI();
}

// Update UI elements
function updateUI() {
    const toggleBtn = document.getElementById('toggleBtn');
    const toggleText = document.getElementById('toggleText');
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');

    if (isRunning) {
        toggleText.textContent = 'Pause';
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        toggleBtn.style.background = '#ef4444';
    } else {
        toggleText.textContent = 'Start';
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        toggleBtn.style.background = '#14b8a6';
    }
}

// Scroll to top functionality
function initScrollToTop() {
    const scrollBtn = document.getElementById('scrollToTop');
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });
    
    scrollBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize displays
    initAnimationCanvas();
    initChart();
    initScrollToTop();
    
    // Generate initial radii
    radii = generateRadii();

    // Event listeners - Controls
    document.getElementById('toggleBtn').addEventListener('click', toggleSimulation);
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);
    
    // Max particle size input
    document.getElementById('maxParticleSize').addEventListener('change', function() {
        const value = parseFloat(this.value);
        if (value >= 10 && value <= 10000) {
            maxParticleSize = value;
            if (!isRunning) resetSimulation();
        } else {
            alert('Please enter a value between 10 and 10,000 nm');
            this.value = maxParticleSize;
        }
    });
    
    // Min particle size input
    document.getElementById('minParticleSize').addEventListener('change', function() {
        const value = parseFloat(this.value);
        if (value >= 0.1 && value <= 1000 && value < maxParticleSize) {
            minParticleSize = value;
            if (!isRunning) resetSimulation();
        } else {
            alert('Please enter a value between 0.1 and 1,000 nm (less than max size)');
            this.value = minParticleSize;
        }
    });
    
    // Diffusion coefficient selector
    const diffusionSelect = document.getElementById('diffusionCoefficient');
    const customDiffusionInput = document.getElementById('customDiffusionInput');
    
    diffusionSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customDiffusionInput.classList.remove('hidden');
        } else {
            customDiffusionInput.classList.add('hidden');
            currentDiffusionCoeff = parseFloat(this.value);
            if (!isRunning) resetSimulation();
        }
    });
    
    document.getElementById('customDiffusion').addEventListener('change', function() {
        const value = parseFloat(this.value);
        if (value > 0 && value < 1) {
            currentDiffusionCoeff = value;
            if (!isRunning) resetSimulation();
        } else {
            alert('Please enter a positive value less than 1 (e.g., 1e-13)');
        }
    });
    
    // Baseline selector
    document.getElementById('baselineSelect').addEventListener('change', function() {
        baselineSize = parseInt(this.value);
        if (!isRunning) resetSimulation();
    });
    
    // Chart type selector
    document.getElementById('chartSelect').addEventListener('change', function() {
        currentChartType = this.value;
        updateChartType();
    });

    // Initial UI update
    updateUI();
    updateStats();
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (animationCanvas) {
            const container = animationCanvas.parentElement;
            animationCanvas.width = container.clientWidth - 32;
            
            // Reposition particles
            baselineParticle.x = animationCanvas.width * 0.25;
            currentParticle.x = animationCanvas.width * 0.75;
            
            drawAnimation();
        }
    });
});