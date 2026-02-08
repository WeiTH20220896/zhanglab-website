// Zhang Lab Website JavaScript
// 页面加载完成后执行

document.addEventListener('DOMContentLoaded', function() {

    // ==========================================
    // 导航栏滚动效果
    // ==========================================
    let lastScrollTop = 0;
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // 添加/移除阴影效果
        if (scrollTop > 50) {
            navbar.classList.add('shadow');
        } else {
            navbar.classList.remove('shadow');
        }

        lastScrollTop = scrollTop;
    });

    // ==========================================
    // 平滑滚动到锚点
    // ==========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

            // 排除 # 本身和 Bootstrap 的 collapse 触发器
            if (href === '#' || this.getAttribute('data-bs-toggle')) {
                return;
            }

            e.preventDefault();

            const target = document.querySelector(href);
            if (target) {
                const offset = 80; // 导航栏高度
                const targetPosition = target.offsetTop - offset;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // 移动端：点击后关闭导航菜单
                const navbarCollapse = document.querySelector('.navbar-collapse');
                if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                    const bsCollapse = new bootstrap.Collapse(navbarCollapse);
                    bsCollapse.hide();
                }
            }
        });
    });

    // ==========================================
    // 滚动显示动画（淡入效果）
    // ==========================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // 观察需要动画的元素
    const animatedElements = document.querySelectorAll(
        '.image-card, .news-card, .area-card, .dimension-card, ' +
        '.member-card, .news-item, .award-item, .pub-item'
    );

    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transition = 'none';
        observer.observe(el);

        // 确保动画完成后元素保持可见
        el.addEventListener('animationend', function() {
            this.style.opacity = '1';
            this.style.transform = 'translateY(0)';
        });
    });

    // ==========================================
    // 导航栏当前页面高亮
    // ==========================================
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');

        // 处理首页
        if (currentPath.endsWith('index.html') || currentPath.endsWith('/')) {
            if (linkPath === 'index.html' || linkPath === '../index.html') {
                link.classList.add('active');
            }
        }
        // 处理其他页面
        else if (currentPath.includes(linkPath)) {
            link.classList.add('active');
        }
    });

    // ==========================================
    // 返回顶部按钮（可选功能）
    // ==========================================
    const backToTopButton = createBackToTopButton();

    function createBackToTopButton() {
        const button = document.createElement('button');
        button.innerHTML = '<i class="bi bi-arrow-up"></i>';
        button.className = 'back-to-top';
        button.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background-color: var(--primary-color, #2563eb);
            color: white;
            border: none;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;

        button.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        document.body.appendChild(button);

        // 显示/隐藏按钮
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                button.style.opacity = '1';
                button.style.visibility = 'visible';
            } else {
                button.style.opacity = '0';
                button.style.visibility = 'hidden';
            }
        });

        return button;
    }

    // ==========================================
    // 卡片悬停效果增强
    // ==========================================
    const cards = document.querySelectorAll('.image-card, .member-card, .news-card');

    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        });
    });

    // ==========================================
    // 表单验证（订阅表单）
    // ==========================================
    const subscribeForm = document.querySelector('.subscribe-form');

    if (subscribeForm) {
        subscribeForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const emailInput = this.querySelector('input[type="email"]');
            const email = emailInput.value.trim();

            if (email && validateEmail(email)) {
                // 这里可以添加实际的订阅逻辑
                alert('感谢订阅！我们会将最新动态发送到您的邮箱。');
                emailInput.value = '';
            } else {
                alert('请输入有效的邮箱地址');
            }
        });
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // ==========================================
    // 图片懒加载（优化性能）
    // ==========================================
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));

    // ==========================================
    // 响应式导航栏行为
    // ==========================================
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarCollapse = document.querySelector('.navbar-collapse');

    if (navbarToggler && navbarCollapse) {
        // 点击页面其他地方时关闭菜单
        document.addEventListener('click', function(e) {
            const isClickInsideNav = navbar.contains(e.target);
            const isNavOpen = navbarCollapse.classList.contains('show');

            if (!isClickInsideNav && isNavOpen) {
                const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
                    toggle: false
                });
                bsCollapse.hide();
            }
        });
    }

    // ==========================================
    // 页面加载动画
    // ==========================================
    window.addEventListener('load', function() {
        document.body.style.opacity = '1';
    });

    // 防止页面闪烁
    document.body.style.transition = 'opacity 0.3s ease';

    // ==========================================
    // 控制台输出（可选）
    // ==========================================
    console.log('%c Zhang Lab Website ', 'background: #2563eb; color: white; padding: 5px 10px; border-radius: 3px;');
    console.log('Website loaded successfully!');

    // ==========================================
    // 移动端触摸优化
    // ==========================================
    if ('ontouchstart' in window) {
        document.body.classList.add('touch-device');
    }

    // ==========================================
    // 阻止右键菜单（可选，用于保护图片）
    // 如果不需要这个功能，可以删除
    // ==========================================
    /*
    document.addEventListener('contextmenu', function(e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    });
    */

    // ==========================================
    // 性能监控（开发模式）
    // ==========================================
    if (window.performance && window.performance.timing) {
        window.addEventListener('load', function() {
            const perfData = window.performance.timing;
            const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
            console.log('Page load time:', pageLoadTime + 'ms');
        });
    }

});

// ==========================================
// 工具函数
// ==========================================

// 节流函数
function throttle(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
