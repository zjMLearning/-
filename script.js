(function enableColumnResizers() {
  const root = document.querySelector('.main-content');
  if (!root) return;

  const leftResizer = document.querySelector('.resizer-left');
  const rightResizer = document.querySelector('.resizer-right');

  let startX = 0;
  let startLeft = 0;
  let startRight = 0;
  let active = null;

  function onMouseDown(e) {
    active = e.currentTarget.dataset.side;
    startX = e.clientX;
    const styles = getComputedStyle(document.querySelector('.main-content'));
    startLeft = parseInt(styles.getPropertyValue('--left-col')) || 350;
    startRight = parseInt(styles.getPropertyValue('--right-col')) || 350;
    e.currentTarget.classList.add('dragging');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!active) return;
    const dx = e.clientX - startX;
    if (active === 'left') {
      const newLeft = Math.max(220, Math.min(600, startLeft + dx));
      root.style.setProperty('--left-col', newLeft + 'px');
    } else if (active === 'right') {
      const newRight = Math.max(220, Math.min(600, startRight - dx));
      root.style.setProperty('--right-col', newRight + 'px');
    }
  }

  function onMouseUp(e) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.querySelectorAll('.column-resizer.dragging').forEach(el => el.classList.remove('dragging'));
    active = null;
  }

  if (leftResizer) leftResizer.addEventListener('mousedown', onMouseDown);
  if (rightResizer) rightResizer.addEventListener('mousedown', onMouseDown);
})();
// 矿山充填系统计算器 - 主要功能模块
class MiningFillCalculator {
    constructor() {
        this.currentTheme = 'light';
        this.charts = {};
        this.init();
    }

    // 初始化应用
    init() {
        this.initEventListeners();
        this.initTabs();
        this.loadSavedData();
        this.calculateAll();
        this.renderCharts();
        this.updateLastUpdate();
        this.setupAutoSave();
    }

    // 初始化事件监听器
    initEventListeners() {
        // 参数输入监听
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                this.calculateAll();
                this.autoSave();
            });
        });

        // 主题切换
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // 导出数据
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // 保存配置
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveConfiguration();
        });

        // 重置参数
        document.getElementById('resetParams').addEventListener('click', () => {
            this.resetParameters();
        });

        // 窗口大小变化时重新调整图表
        window.addEventListener('resize', () => {
            this.resizeCharts();
        });
    }

    // 初始化选项卡功能
    initTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab);
            });
        });
    }

    // 切换选项卡
    switchTab(selectedTab) {
        // 移除所有活动标签
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // 设置当前活动标签
        selectedTab.classList.add('active');

        // 显示对应内容
        const tabName = selectedTab.getAttribute('data-tab');
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-pane`).classList.add('active');
    }

    // 计算所有值
    calculateAll() {
        try {
            const params = this.getParameters();
            const results = this.performCalculations(params);
            this.updateResults(results);
            this.updateStatistics(results);
        } catch (error) {
            console.error('计算过程中出现错误:', error);
            this.showNotification('计算过程中出现错误，请检查输入参数', 'error');
        }
    }

    // 获取所有参数值
    getParameters() {
        const params = {};
        const inputs = document.querySelectorAll('input');
        
        inputs.forEach(input => {
            const id = input.id;
            const value = parseFloat(input.value) || 0;
            params[id] = value;
        });

        return params;
    }

    // 执行所有计算
    performCalculations(params) {
        const results = {};

        // 矿山开采计算
        results.Qa = params.z * params.pa / params.gamma_k; // 年平均充填实体量
        results.Qc = results.Qa / params.T; // 日平均充填实体量
        results.Qs = params.K1 * params.K2 * results.Qc; // 日平均充填料浆量
        results.Qd = params.K3 * results.Qs; // 日充填料浆制备能力
        results.qh = results.Qd / params.t; // 小时充填料浆制备能力

        // 料浆密度计算
        const rho_c = params.rho_c;
        const rho_a = params.rho_a;
        const N = params.N;
        const Cw = params.Cw;
        
        // 料浆密度公式
        const numerator = rho_c * rho_a * (1 + N);
        const denominator = Cw * (rho_a + N * rho_c) + (1 - Cw) * rho_c * rho_a * (1 + N);
        results.rho_m = numerator / denominator;

        // 材料消耗计算
        results.ma = results.rho_m * (N * Cw) / (1 + N); // 每m³料浆中集料质量
        results.mc = results.rho_m * Cw / (1 + N); // 每m³料浆中胶凝材料质量
        results.Qj = params.q * params.t * params.T * results.mc; // 胶凝材料年消耗量
        results.Q_sand = params.q * params.t * params.T * results.ma; // 全尾砂年消耗量

        // 浓密机选型计算
        const q = params.q;
        const t = params.t;
        const mu = 0.0001; // 沉降速度系数 (m/h)
        
        results.D = 2 * Math.sqrt(q / (t * mu * Math.PI)); // 浓密机直径
        results.V1 = Math.PI * Math.pow(results.D, 2) / 4; // 单位直筒高度沉积床体积
        
        // 浓密机高度计算
        const H0 = 1.2; // 进料井高度 (m)
        const H1 = 6.58; // 沉积床高度 (m)
        const H2 = 3.0; // 自由沉降高度 (m)
        results.H = H0 + H1 + H2; // 浓密机总高度

        // 絮凝剂设备选型
        const gx = 0.002; // 絮凝剂添加比例 (t/m³)
        const omega_x = 0.001; // 絮凝剂溶液浓度 (0.1%)
        const K4 = 1.2; // 絮凝剂制备不均衡系数
        
        results.qx = q * gx; // 絮凝剂小时用量
        results.qss = results.qx * (1 - omega_x) / (1000 * omega_x); // 絮凝剂小时用水量
        results.Qxz = results.qx * t * K4; // 絮凝剂制备能力

        // 溢流水量计算
        const Pd = params.pd;
        const T = params.T;
        const Ca = params.Ca;
        const Cd = params.Cd;
        const rho_a_param = params.rho_a;
        
        results.q1 = Pd / (T * t * Ca * rho_a_param); // 尾矿来料小时流量
        results.q2 = Pd / (T * t * Cd * rho_a_param); // 底流小时流量
        results.q_overflow = results.q1 - results.q2 + results.qss; // 溢流水量

        return results;
    }

    // 更新计算结果
    updateResults(results) {
        // 更新矿山开采计算结果
        this.updateElement('Qa', results.Qa, 0);
        this.updateElement('Qc', results.Qc, 0);
        this.updateElement('Qs', results.Qs, 0);
        this.updateElement('Qd', results.Qd, 0);
        this.updateElement('qh', results.qh, 0);

        // 更新材料消耗计算结果
        this.updateElement('rho_m', results.rho_m, 3);
        this.updateElement('ma', results.ma, 3);
        this.updateElement('mc', results.mc, 3);
        this.updateElement('Qj', results.Qj, 1);
        this.updateElement('Q_sand', results.Q_sand, 0);

        // 更新浓密机选型计算结果
        this.updateElement('D', results.D, 2);
        this.updateElement('V1', results.V1, 1);
        this.updateElement('H', results.H, 0);

        // 更新絮凝剂选型计算结果
        this.updateElement('qx', results.qx, 2);
        this.updateElement('qss', results.qss, 2);
        this.updateElement('Qxz', results.Qxz, 2);

        // 更新溢流水计算结果
        this.updateElement('q1', results.q1, 2);
        this.updateElement('q2', results.q2, 2);
        this.updateElement('q_overflow', results.q_overflow, 2);
    }

    // 更新元素值
    updateElement(id, value, decimals) {
        const element = document.getElementById(id);
        if (element) {
            if (decimals === 0) {
                element.textContent = Math.round(value).toLocaleString();
            } else {
                element.textContent = value.toFixed(decimals);
            }
        }
    }

    // 更新统计信息
    updateStatistics(results) {
        document.getElementById('stat-sand').innerHTML = 
            Math.round(results.Q_sand).toLocaleString() + ' <span class="unit">t/a</span>';
        document.getElementById('stat-cement').innerHTML = 
            Math.round(results.Qj).toLocaleString() + ' <span class="unit">t/a</span>';
        document.getElementById('stat-fill').innerHTML = 
            Math.round(results.Qc).toLocaleString() + ' <span class="unit">m³/d</span>';
        document.getElementById('stat-hourly').innerHTML = 
            Math.round(results.qh).toLocaleString() + ' <span class="unit">m³/h</span>';
    }

    // 渲染所有图表
    renderCharts() {
        this.renderConsumptionChart();
        this.renderThickenerChart();
        this.renderSlurryChart();
    }

    // 渲染材料消耗图表
    renderConsumptionChart() {
        const chartDom = document.getElementById('consumptionChart');
        if (!chartDom) return;

        const chart = echarts.init(chartDom);
        this.charts.consumption = chart;

        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(param => {
                        result += param.seriesName + ': ' + param.value.toLocaleString() + ' t<br/>';
                    });
                    return result;
                }
            },
            legend: {
                data: ['年消耗量', '日消耗量'],
                bottom: 10,
                textStyle: { color: 'var(--gray-700)' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '15%',
                top: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: ['全尾砂', '胶凝材料', '补充水', '絮凝剂'],
                axisLabel: { color: 'var(--gray-600)' }
            },
            yAxis: {
                type: 'value',
                name: '吨(t)',
                nameTextStyle: { color: 'var(--gray-600)' },
                axisLabel: { color: 'var(--gray-600)' }
            },
            series: [
                {
                    name: '年消耗量',
                    type: 'bar',
                    data: [142890, 16084, 15000, 8],
                    itemStyle: { 
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#3498db' },
                            { offset: 1, color: '#2980b9' }
                        ])
                    }
                },
                {
                    name: '日消耗量',
                    type: 'bar',
                    data: [476, 54, 50, 0.03],
                    itemStyle: { 
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#2ecc71' },
                            { offset: 1, color: '#27ae60' }
                        ])
                    }
                }
            ]
        };

        chart.setOption(option);
    }

    // 渲染浓密机参数图表
    renderThickenerChart() {
        const chartDom = document.getElementById('thickenerChart');
        if (!chartDom) return;

        const chart = echarts.init(chartDom);
        this.charts.thickener = chart;

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} m ({d}%)'
            },
            legend: {
                orient: 'horizontal',
                bottom: 10,
                data: ['进料井高度', '沉积床高度', '自由沉降高度'],
                textStyle: { color: 'var(--gray-700)' }
            },
            series: [
                {
                    name: '浓密机高度',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    center: ['50%', '40%'],
                    avoidLabelOverlap: false,
                    itemStyle: {
                        borderRadius: 10,
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    label: {
                        show: false,
                        position: 'center'
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: '18',
                            fontWeight: 'bold'
                        }
                    },
                    labelLine: {
                        show: false
                    },
                    data: [
                        { 
                            value: 1.2, 
                            name: '进料井高度',
                            itemStyle: { color: '#3498db' }
                        },
                        { 
                            value: 6.58, 
                            name: '沉积床高度',
                            itemStyle: { color: '#2ecc71' }
                        },
                        { 
                            value: 3, 
                            name: '自由沉降高度',
                            itemStyle: { color: '#e74c3c' }
                        }
                    ]
                }
            ]
        };

        chart.setOption(option);
    }

    // 渲染料浆组分比例图表
    renderSlurryChart() {
        const chartDom = document.getElementById('slurryChart');
        if (!chartDom) return;

        const chart = echarts.init(chartDom);
        this.charts.slurry = chart;

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} t/m³ ({d}%)'
            },
            legend: {
                bottom: 10,
                left: 'center',
                data: ['集料', '胶凝材料', '水'],
                textStyle: { color: 'var(--gray-700)' }
            },
            series: [
                {
                    name: '料浆组分',
                type: 'pie',
                    radius: '70%',
                    center: ['50%', '45%'],
                    data: [
                        { 
                            value: 0.992, 
                            name: '集料',
                            itemStyle: { color: '#3498db' }
                        },
                        { 
                            value: 0.124, 
                            name: '胶凝材料',
                            itemStyle: { color: '#2ecc71' }
                        },
                        { 
                            value: 0.601, 
                            name: '水',
                            itemStyle: { color: '#e74c3c' }
                        }
                    ],
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
                }
            ]
        };

        chart.setOption(option);
    }

    // 调整图表大小
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }

    // 切换主题
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        // 更新主题切换按钮图标
        const themeIcon = document.querySelector('#themeToggle i');
        if (this.currentTheme === 'dark') {
            themeIcon.className = 'fas fa-sun';
        } else {
            themeIcon.className = 'fas fa-moon';
        }

        // 重新渲染图表以适应新主题
        setTimeout(() => {
            this.renderCharts();
        }, 100);

        // 保存主题偏好
        localStorage.setItem('theme', this.currentTheme);
        
        this.showNotification(`已切换到${this.currentTheme === 'dark' ? '深色' : '浅色'}主题`);
    }

    // 导出数据
    exportData() {
        try {
            const params = this.getParameters();
            const results = this.performCalculations(params);
            
            const exportData = {
                timestamp: new Date().toISOString(),
                parameters: params,
                results: results,
                summary: {
                    annualFillVolume: results.Qa,
                    dailyFillVolume: results.Qc,
                    annualSandConsumption: results.Q_sand,
                    annualCementConsumption: results.Qj,
                    thickenerDiameter: results.D,
                    thickenerHeight: results.H
                }
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `矿山充填系统计算结果_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showNotification('数据导出成功！');
        } catch (error) {
            console.error('导出失败:', error);
            this.showNotification('数据导出失败，请重试', 'error');
        }
    }

    // 保存配置
    saveConfiguration() {
        try {
            const params = this.getParameters();
            const config = {
                timestamp: new Date().toISOString(),
                parameters: params,
                theme: this.currentTheme
            };
            
            localStorage.setItem('miningFillConfig', JSON.stringify(config));
            this.showNotification('配置保存成功！');
        } catch (error) {
            console.error('保存失败:', error);
            this.showNotification('配置保存失败，请重试', 'error');
        }
    }

    // 加载保存的数据
    loadSavedData() {
        try {
            const savedConfig = localStorage.getItem('miningFillConfig');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                
                // 加载参数
                if (config.parameters) {
                    Object.keys(config.parameters).forEach(key => {
                        const input = document.getElementById(key);
                        if (input) {
                            input.value = config.parameters[key];
                        }
                    });
                }
                
                // 加载主题
                if (config.theme) {
                    this.currentTheme = config.theme;
                    document.documentElement.setAttribute('data-theme', this.currentTheme);
                    const themeIcon = document.querySelector('#themeToggle i');
                    if (this.currentTheme === 'dark') {
                        themeIcon.className = 'fas fa-sun';
                    }
                }
            }
        } catch (error) {
            console.error('加载保存数据失败:', error);
        }
    }

    // 重置参数
    resetParameters() {
        if (confirm('确定要重置所有参数到默认值吗？')) {
            const defaultValues = {
                pa: 144000,
                gamma_k: 2.79,
                z: 1,
                T: 300,
                K1: 1.05,
                K2: 1.05,
                K3: 1.2,
                t: 12,
                pd: 429.6,
                rho_c: 3.15,
                rho_a: 2.76,
                N: 8,
                Cw: 0.65,
                Cd: 0.63,
                Ca: 0.2,
                V: 11.5297,
                q: 40
            };

            Object.keys(defaultValues).forEach(key => {
                const input = document.getElementById(key);
                if (input) {
                    input.value = defaultValues[key];
                }
            });

            this.calculateAll();
            this.showNotification('参数已重置为默认值');
        }
    }

    // 自动保存
    autoSave() {
        // 防抖处理，避免频繁保存
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.saveConfiguration();
        }, 2000);
    }

    // 设置自动保存
    setupAutoSave() {
        // 每5分钟自动保存一次
        setInterval(() => {
            this.saveConfiguration();
        }, 5 * 60 * 1000);
    }

    // 显示通知
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        if (notification && notificationText) {
            notificationText.textContent = message;
            
            // 设置通知类型样式
            notification.className = `notification ${type}`;
            if (type === 'error') {
                notification.style.background = 'var(--accent)';
            } else if (type === 'warning') {
                notification.style.background = 'var(--warning)';
            } else {
                notification.style.background = 'var(--success)';
            }
            
            // 显示通知
            notification.classList.add('show');
            
            // 3秒后自动隐藏
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }

    // 更新最后更新时间
    updateLastUpdate() {
        const lastUpdateElement = document.getElementById('lastUpdate');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = new Date().toLocaleString('zh-CN');
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 等待MathJax加载完成
    if (window.MathJax) {
        MathJax.typesetPromise().then(() => {
            new MiningFillCalculator();
        });
    } else {
        // 如果MathJax未加载，直接初始化
        new MiningFillCalculator();
    }
});

// 添加键盘快捷键支持
document.addEventListener('keydown', function(event) {
    // Ctrl+S 保存配置
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        document.getElementById('saveBtn').click();
    }
    
    // Ctrl+E 导出数据
    if (event.ctrlKey && event.key === 'e') {
        event.preventDefault();
        document.getElementById('exportBtn').click();
    }
    
    // Ctrl+T 切换主题
    if (event.ctrlKey && event.key === 't') {
        event.preventDefault();
        document.getElementById('themeToggle').click();
    }
});

// 添加页面可见性变化监听
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // 页面重新可见时，重新调整图表大小
        setTimeout(() => {
            if (window.calculator && window.calculator.resizeCharts) {
                window.calculator.resizeCharts();
            }
        }, 100);
    }
});

// 添加错误处理
window.addEventListener('error', function(event) {
    console.error('页面错误:', event.error);
    if (window.calculator && window.calculator.showNotification) {
        window.calculator.showNotification('页面出现错误，请刷新重试', 'error');
    }
});

// 添加未处理的Promise拒绝处理
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
    if (window.calculator && window.calculator.showNotification) {
        window.calculator.showNotification('操作失败，请重试', 'error');
    }
});