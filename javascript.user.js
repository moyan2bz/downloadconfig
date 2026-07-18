// ==UserScript==
// @name         自动配发辅助工具
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  配发辅助工具
// @author       Anonymous
// @match        *://10.4.188.1/pcs-web/a/pcs/PickuploadDespatch/toScanPack?*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    const VERSION = '20260718';

    // 从父页面获取员工信息1
    let username = '';
    let usernamestr = '';

    function getEmployeeInfoFromParent() {
        try {
            // 检查是否在iframe中
            if (window.parent && window.parent !== window) {
                // 从父页面获取员工姓名（id为user的元素）
                const userElement = window.parent.document.getElementById('user');
                if (userElement) {
                    username = userElement.textContent || userElement.value || '';
                }

                // 从父页面获取员工工号（id为userNameStr的元素）
                const userNameStrElement = window.parent.document.getElementById('userNameStr');
                if (userNameStrElement) {
                    usernamestr = userNameStrElement.textContent || userNameStrElement.value || '';
                }

                // 如果通过id获取失败，尝试其他方式1
                if (!username || !usernamestr) {
                    // 方法1: 通过常见的class名或属性查找
                    const possibleUserElements = window.parent.document.querySelectorAll('[id*="user"], [class*="user"], [name*="user"]');
                    for (let element of possibleUserElements) {
                        const text = element.textContent || element.value || '';
                        if (text && !username && (element.id.includes('user') || element.className.includes('user'))) {
                            username = text;
                        }
                        if (text && !usernamestr && (element.id.includes('Name') || element.className.includes('name'))) {
                            usernamestr = text;
                        }
                    }

                    // 方法2: 通过数据属性查找
                    if (!username || !usernamestr) {
                        const dataUserElements = window.parent.document.querySelectorAll('[data-user], [data-username]');
                        for (let element of dataUserElements) {
                            const text = element.textContent || element.value || element.getAttribute('data-user') || element.getAttribute('data-username') || '';
                            if (text) {
                                if (!username) username = text;
                                else if (!usernamestr) usernamestr = text;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // 静默处理错误
        }
    }

    // 在插件初始化时调用
    getEmployeeInfoFromParent();

    // 获取北京时间函数
    function getBeijingTime() {
        const now = new Date();
        // 北京时间 = UTC+8
        const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        return beijingTime.toISOString().replace('T', ' ').substring(0, 19);
    }

    // 获取格式化时间（用于文件名）
    function getFormattedTime() {
        const now = new Date();
        const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        return beijingTime.toISOString().replace(/[-:]/g, '').replace('T', '_').substring(0, 15);
    }

    // 添加上传员工记录的函数 - 修改后添加file_name字段
    function uploadEmployeeRecord(distributionCount, fileName = '') {
        try {
            const uploadData = {
                employee_name: username || '未知',
                employee_id: usernamestr || '未知',
                use_time: getBeijingTime(),
                distribution_count: distributionCount,
                file_name: fileName // 添加文件名字段
            };

            GM_xmlhttpRequest({
                method: "POST",
                url: getApiBaseUrl() + "/api/upload.php",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-KEY": AUTH_CONFIG.API_KEY
                },
                data: JSON.stringify(uploadData),
                timeout: 4000,
                onload: function(response) {
                    if (response.status !== 200) {
                        // 静默处理失败
                    }
                },
                onerror: function(error) {
                    // 静默处理错误
                },
                ontimeout: function() {
                    // 静默处理超时
                }
            });

        } catch (error) {
            // 静默处理错误
        }
    }

    // 上传文件到服务器
    function uploadFileToServer(file, newFileName) {
        return new Promise((resolve, reject) => {
            try {
                const formData = new FormData();
                // 创建新的Blob对象，使用新文件名
                const newFile = new File([file], newFileName, { type: file.type });
                formData.append('file', newFile);

                GM_xmlhttpRequest({
                    method: "POST",
                    url: getApiBaseUrl() + "/api/fileupload.php",
                    data: formData,
                    timeout: 4000,
                    onload: function(response) {
                        if (response.status === 200) {
                            resolve(true);
                        } else {
                            resolve(false); // 静默失败，不阻止流程
                        }
                    },
                    onerror: function(error) {
                        resolve(false); // 静默失败，不阻止流程
                    },
                    ontimeout: function() {
                        resolve(false); // 静默失败，不阻止流程
                    }
                });
            } catch (error) {
                resolve(false); // 静默失败，不阻止流程
            }
        });
    }

    // 生成新的文件名：姓名_工号_时间.txt
    function generateNewFileName(originalFile) {
        const originalName = originalFile.name;
        const fileExtension = originalName.substring(originalName.lastIndexOf('.'));

        // 清理姓名和工号中的特殊字符
        const cleanName = (username || '未知').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
        const cleanId = (usernamestr || '未知').replace(/[^a-zA-Z0-9]/g, '');
        const timeStr = getFormattedTime();

        const newFileName = cleanId + '_' + timeStr + fileExtension;
        return newFileName;
    }

    // 简单的加密解密函数（使用Base64和简单混淆）
    const CryptoUtils = {
        // 简单的混淆密钥
        key: 'auto_dispatch_2024',

        encrypt: function(text) {
            try {
                // 添加时间戳和随机数增加复杂性
                const data = JSON.stringify({
                    data: text,
                    timestamp: Date.now(),
                    random: Math.random().toString(36).substring(2, 15)
                });

                // 简单的XOR加密
                let encrypted = '';
                for (let i = 0; i < data.length; i++) {
                    const keyChar = this.key.charCodeAt(i % this.key.length);
                    const dataChar = data.charCodeAt(i);
                    encrypted += String.fromCharCode(dataChar ^ keyChar);
                }

                return btoa(encrypted);
            } catch (error) {
                return null;
            }
        },

        decrypt: function(encryptedText) {
            try {
                // Base64解码
                const decoded = atob(encryptedText);

                // XOR解密
                let decrypted = '';
                for (let i = 0; i < decoded.length; i++) {
                    const keyChar = this.key.charCodeAt(i % this.key.length);
                    const encryptedChar = decoded.charCodeAt(i);
                    decrypted += String.fromCharCode(encryptedChar ^ keyChar);
                }

                // 解析JSON数据
                const parsed = JSON.parse(decrypted);
                return parsed.data;
            } catch (error) {
                return null;
            }
        },

        // 加密到期时间信息
        encryptExpireTime: function(licenseData) {
            if (!licenseData) return null;

            const expireInfo = {
                expire_time: licenseData.expire_time,
                card_type: licenseData.card_type,
                duration: licenseData.duration,
                total_count: licenseData.total_count,
                remaining_count: licenseData.remaining_count,
                encrypted_at: Date.now()
            };

            return this.encrypt(JSON.stringify(expireInfo));
        },

        // 解密的期时间信息
        decryptExpireTime: function(encryptedData) {
            if (!encryptedData) return null;

            try {
                const decrypted = this.decrypt(encryptedData);
                if (!decrypted) return null;

                return JSON.parse(decrypted);
            } catch (error) {
                return null;
            }
        }
    };

    // 生成12位大小写字母和数字混合的ID
    function generateMixedId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // 获取或创建设备ID
    function getOrCreateDeviceId() {
        // 检查本地存储中是否已生成过ID
        const idGenerated = GM_getValue("device_id_generated", false);

        if (idGenerated) {
            // 如果已生成过，从本地存储读取设备ID
            const storedDeviceId = GM_getValue("device_id");
            if (storedDeviceId) {
                return storedDeviceId;
            }
        }

        // 生成新的设备ID
        const newDeviceId = generateMixedId();

        // 保存到本地存储（永久保存）
        GM_setValue("device_id", newDeviceId);
        GM_setValue("device_id_generated", true);

        // 设置Cookie（永久保存）
        const cookieExpires = new Date(Date.now() + 999 * 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = "device_id=" + newDeviceId + "; expires=" + cookieExpires + "; path=/";
        document.cookie = "device_id_generated=true; expires=" + cookieExpires + "; path=/";

        return newDeviceId;
    }

    // 计算剩余时间
    function calculateRemainingTime(licenseData) {
        if (!licenseData) return '未知';

        const cardType = licenseData.card_type;

        if (cardType === 'time') {
            const duration = parseInt(licenseData.duration) || 0;

            if (duration === 0) {
                return '永久';
            }

            const expireTime = licenseData.expire_time;
            if (!expireTime) {
                return '未知';
            }

            const expireDate = new Date(expireTime);
            const now = new Date();

            if (isNaN(expireDate.getTime())) {
                return '时间格式错误';
            }

            const timeDiff = expireDate.getTime() - now.getTime();

            if (timeDiff <= 0) {
                return '已过期';
            }

            // 计算剩余天数
            const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            return days + '天';

        } else if (cardType === 'count') {
            const remainingCount = parseInt(licenseData.remaining_count) || 0;
            return remainingCount + '次';
        }

        return '未知';
    }

    const DOMAIN_CONFIG = {
        DISTRIBUTION_URL: "https://gitee.com/moyan1bz/downloadconfig/raw/master/config.json",
        API_BASE_COOKIE_KEY: "auto_dispatch_api_base",
        API_BASE_DEFAULT_ENCRYPTED: "",
        ENCRYPT_KEY: "qweishndkjlahdqe",
        ENCRYPT_SALT: "dfohnamenr",
        IGNORED_VERSION_KEY: "auto_dispatch_ignored_version",
        UPDATE_SCRIPT_URL: "https://gitee.com/moyan1bz/downloadconfig/raw/master/自动配发辅助工具.user.js"
    };

    function decryptApiUrl(encryptedText) {
        if (!encryptedText) return null;
        try {
            const key = DOMAIN_CONFIG.ENCRYPT_KEY;
            const salt = DOMAIN_CONFIG.ENCRYPT_SALT;
            const decoded = atob(encryptedText);
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                const keyChar = key.charCodeAt(i % key.length);
                const encryptedChar = decoded.charCodeAt(i);
                decrypted += String.fromCharCode(encryptedChar ^ keyChar);
            }
            if (decrypted.startsWith(salt) && decrypted.endsWith(salt)) {
                return decrypted.substring(salt.length, decrypted.length - salt.length);
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    function getCookie(name) {
        const value = "; " + document.cookie;
        const parts = value.split("; " + name + "=");
        if (parts.length === 2) return parts.pop().split(";").shift();
        return null;
    }

    function setCookie(name, value, days = 999) {
        const expires = new Date(Date.now() + days * 365 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = name + "=" + value + "; expires=" + expires + "; path=/";
    }

    async function fetchDomainConfig() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: DOMAIN_CONFIG.DISTRIBUTION_URL,
                timeout: 4000,
                onload: function(response) {
                    try {
                        if (response.status === 200) {
                            const config = JSON.parse(response.responseText);
                            if (config && config.main) {
                                const encryptedUrl = config.main;
                                setCookie(DOMAIN_CONFIG.API_BASE_COOKIE_KEY, encryptedUrl);
                                const decryptedUrl = decryptApiUrl(encryptedUrl);
                                resolve(decryptedUrl);
                                return;
                            }
                        }
                    } catch (error) {
                        // 静默处理解析错误
                    }
                    const cookieEncrypted = getCookie(DOMAIN_CONFIG.API_BASE_COOKIE_KEY);
                    const finalEncrypted = cookieEncrypted || DOMAIN_CONFIG.API_BASE_DEFAULT_ENCRYPTED;
                    resolve(decryptApiUrl(finalEncrypted));
                },
                onerror: function() {
                    const cookieEncrypted = getCookie(DOMAIN_CONFIG.API_BASE_COOKIE_KEY);
                    const finalEncrypted = cookieEncrypted || DOMAIN_CONFIG.API_BASE_DEFAULT_ENCRYPTED;
                    resolve(decryptApiUrl(finalEncrypted));
                },
                ontimeout: function() {
                    const cookieEncrypted = getCookie(DOMAIN_CONFIG.API_BASE_COOKIE_KEY);
                    const finalEncrypted = cookieEncrypted || DOMAIN_CONFIG.API_BASE_DEFAULT_ENCRYPTED;
                    resolve(decryptApiUrl(finalEncrypted));
                }
            });
        });
    }

    function getApiBaseUrl() {
        const cookieEncrypted = getCookie(DOMAIN_CONFIG.API_BASE_COOKIE_KEY);
        const finalEncrypted = cookieEncrypted || DOMAIN_CONFIG.API_BASE_DEFAULT_ENCRYPTED;
        return decryptApiUrl(finalEncrypted);
    }

    let apiBaseUrl = decryptApiUrl(DOMAIN_CONFIG.API_BASE_DEFAULT_ENCRYPTED);

    async function checkForUpdates() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: DOMAIN_CONFIG.DISTRIBUTION_URL,
                timeout: 4000,
                onload: function(response) {
                    try {
                        if (response.status === 200) {
                            const config = JSON.parse(response.responseText);
                            if (config && config.version) {
                                const remoteVersion = config.version;
                                const ignoredVersion = GM_getValue(DOMAIN_CONFIG.IGNORED_VERSION_KEY);
                                if (ignoredVersion === remoteVersion) {
                                    resolve(null);
                                    return;
                                }
                                if (remoteVersion > VERSION) {
                                    const updateInfo = {
                                        version: remoteVersion,
                                        changelog: config.changelog || '暂无更新日志'
                                    };
                                    resolve(updateInfo);
                                    return;
                                }
                            }
                        }
                    } catch (error) {
                        // 静默处理解析错误
                    }
                    resolve(null);
                },
                onerror: function() {
                    resolve(null);
                },
                ontimeout: function() {
                    resolve(null);
                }
            });
        });
    }

    function showUpdateDialog(updateInfo) {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            padding: 24px;
            width: 420px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 999998;
        `;

        dialog.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;">🔔</div>
                <div style="font-size: 18px; font-weight: bold; color: #333;">检测到新版本 - ${updateInfo.version}</div>
                <div style="font-size: 14px; color: #888; margin-top: 4px;">当前版本 - ${VERSION}</div>
            </div>
            <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 20px; max-height: 150px; overflow-y: auto;">
                <div style="font-size: 14px; color: #555; line-height: 1.6; white-space: pre-wrap;">${updateInfo.changelog}</div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="update-later-btn" style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; background: white; color: #666; font-size: 14px; cursor: pointer;">下次再说</button>
                <button id="update-ignore-btn" style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; background: white; color: #666; font-size: 14px; cursor: pointer;">忽略本次更新</button>
                <button id="update-now-btn" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 14px; font-weight: 600; cursor: pointer;">立即更新</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(dialog);

        document.getElementById('update-later-btn').addEventListener('click', () => {
            document.body.removeChild(dialog);
            document.body.removeChild(overlay);
        });

        document.getElementById('update-ignore-btn').addEventListener('click', () => {
            GM_setValue(DOMAIN_CONFIG.IGNORED_VERSION_KEY, updateInfo.version);
            document.body.removeChild(dialog);
            document.body.removeChild(overlay);
        });

        document.getElementById('update-now-btn').addEventListener('click', async () => {
            const btn = document.getElementById('update-now-btn');
            btn.textContent = '更新中...';
            btn.disabled = true;

            try {
                GM_openInTab(DOMAIN_CONFIG.UPDATE_SCRIPT_URL, { active: true });

                setTimeout(() => {
                    document.body.removeChild(dialog);
                    document.body.removeChild(overlay);
                }, 1000);
            } catch (error) {
                btn.textContent = '更新失败';
                btn.style.background = '#dc3545';
                setTimeout(() => {
                    document.body.removeChild(dialog);
                    document.body.removeChild(overlay);
                }, 2000);
            }
        });
    }

    function applyUpdateIfAvailable() {
        GM_deleteValue('auto_dispatch_new_script');
        GM_deleteValue('auto_dispatch_new_version');
        GM_deleteValue('auto_dispatch_applying_update');
    }

    async function initDomainConfig() {
        apiBaseUrl = await fetchDomainConfig();
        AUTH_CONFIG.VALIDATION_URL = apiBaseUrl + "/api/verify.php";
    }

    // 授权验证配置
    const AUTH_CONFIG = {
        VALIDATION_URL: decryptApiUrl(DOMAIN_CONFIG.API_BASE_DEFAULT_ENCRYPTED) + "/api/verify.php",
        API_KEY: "035ba26a0c68ef170d72aaa3bf3ee866",
        STORAGE_KEY: "auto_dispatch_license",
        ENCRYPTED_EXPIRE_KEY: "auto_dispatch_encrypted_expire",
        DEVICE_ID: getOrCreateDeviceId()
    };

    // 配置变量 - 将默认间隔改为秒（0.2秒 = 200毫秒）
    let inputInterval = 0.2 * 1000; // 转换为毫秒存储
    let isInputting = false;
    let inputQueue = [];
    let activeElement = null;
    let currentIndex = 0;
    let pauseTimer = null;
    let isPaused = false;
    let isLicensed = false;
    let currentLicenseKey = '';
    let pluginEnabled = false;
    let currentFile = null; // 存储当前处理的文件
    let failedOrders = []; // 存储出现"无配发信息"弹窗的单号
    let fileUploaded = false; // 标记文件是否已上传
    let uploadFileName = ''; // 预先生成的上传文件名

    // 启动时清空失败单号记录
    failedOrders = [];

    // 启动时先初始化域名配置，然后检查授权，最后检查更新
    initDomainConfig().then(() => {
        checkLicenseOnStart();
    }).then(() => {
        applyUpdateIfAvailable();
    }).then(() => {
        checkForUpdates().then((updateInfo) => {
            if (updateInfo) {
                showUpdateDialog(updateInfo);
            }
        });
    });

    // 启动时检查授权
    async function checkLicenseOnStart() {
        const cachedValidation = GM_getValue(AUTH_CONFIG.STORAGE_KEY);

        if (cachedValidation && cachedValidation.licenseKey) {
            await validateCachedLicense(cachedValidation.licenseKey);
        } else {
            // 检查是否有加密的到期时间信息
            const encryptedExpireData = GM_getValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY);
            if (encryptedExpireData) {
                const expireInfo = CryptoUtils.decryptExpireTime(encryptedExpireData);
                if (expireInfo && !isLicenseExpired(expireInfo)) {
                    showLicenseInputWithFallback(expireInfo);
                    return;
                }
            }
            showLicenseInput();
        }
    }

    // 验证缓存的许可证
    async function validateCachedLicense(licenseKey) {
        try {
            const result = await validateLicenseWithServer(licenseKey);

            if (result.code === 0) {
                // 检查授权码是否过期
                if (isLicenseExpired(result.data)) {
                    clearLicenseCache();
                    showLicenseInput();
                    showNotification('授权码已过期，请重新授权', 'error');
                    return;
                }

                isLicensed = true;
                currentLicenseKey = licenseKey;
                pluginEnabled = true;

                // 存储验证结果（包含授权信息）
                GM_setValue(AUTH_CONFIG.STORAGE_KEY, {
                    valid: true,
                    licenseKey: licenseKey,
                    deviceId: AUTH_CONFIG.DEVICE_ID,
                    licenseData: result.data,
                    lastValidation: Date.now()
                });

                // 加密存储到期时间信息
                saveEncryptedExpireTime(result.data);

                initializePlugin();
                showNotification('授权验证成功！插件已激活。', 'success');
                showLicenseInfo(result.data);
            } else {
                // 验证失败，尝试使用本地加密的到期时间
                const encryptedExpireData = GM_getValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY);
                if (encryptedExpireData) {
                    const expireInfo = CryptoUtils.decryptExpireTime(encryptedExpireData);
                    if (expireInfo && !isLicenseExpired(expireInfo)) {
                        // 使用本地存储的到期时间继续运行
                        isLicensed = true;
                        currentLicenseKey = licenseKey;
                        pluginEnabled = true;
                        initializePlugin();
                        showNotification('使用本地授权', 'warning');
                        showLicenseInfo(expireInfo);
                        return;
                    }
                }

                clearLicenseCache();
                showLicenseInput();
                showNotification('许可证已失效: ' + result.message, 'error');
            }
        } catch (error) {
            // 根据HTTP状态码处理错误
            if (error.status === 400) {
                // 400错误：清除所有存储并要求重新输入
                clearAllStorage();
                showLicenseInput();
                showNotification('授权验证失败，请重新输入授权码', 'error');
            } else if (error.status === 403 || error.status === 404) {
                // 403/404错误：尝试使用本地存储，不清理存储
                handleLocalValidation(licenseKey);
            } else {
                // 其他网络错误：尝试使用本地存储
                handleLocalValidation(licenseKey);
            }
        }
    }

    // 处理本地验证
    function handleLocalValidation(licenseKey) {
        const cachedValidation = GM_getValue(AUTH_CONFIG.STORAGE_KEY);
        const encryptedExpireData = GM_getValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY);

        if (cachedValidation && cachedValidation.licenseData) {
            if (isLicenseExpired(cachedValidation.licenseData)) {
                showLicenseInput();
                showNotification('本地授权已过期，请重新授权', 'error');
                return;
            }

            // 使用缓存的授权信息
            isLicensed = true;
            currentLicenseKey = licenseKey;
            pluginEnabled = true;
            initializePlugin();
            showNotification('使用本地授权', 'warning');
            showLicenseInfo(cachedValidation.licenseData);
        } else if (encryptedExpireData) {
            const expireInfo = CryptoUtils.decryptExpireTime(encryptedExpireData);
            if (expireInfo && !isLicenseExpired(expireInfo)) {
                // 使用加密的到期时间信息继续运行
                isLicensed = true;
                currentLicenseKey = licenseKey;
                pluginEnabled = true;
                initializePlugin();
                showNotification('使用本地授权信息', 'warning');
                showLicenseInfo(expireInfo);
            } else {
                showNotification('网络连接失败且本地授权无效，请检查网络后重试', 'error');
                showLicenseInput();
            }
        } else {
            showNotification('网络连接失败，请检查网络后重试', 'error');
            showLicenseInput();
        }
    }

    // 服务器验证许可证 - 使用GET方法
    function validateLicenseWithServer(licenseKey) {
        return new Promise((resolve, reject) => {
            const url = AUTH_CONFIG.VALIDATION_URL + "?api_key=" + encodeURIComponent(AUTH_CONFIG.API_KEY) + "&card_key=" + encodeURIComponent(licenseKey) + "&device_id=" + encodeURIComponent(AUTH_CONFIG.DEVICE_ID);

            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                timeout: 4000,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);

                        // 根据HTTP状态码处理
                        if (response.status === 400) {
                            const error = new Error(data.message || '请求参数错误');
                            error.status = 400;
                            reject(error);
                            return;
                        } else if (response.status === 403) {
                            const error = new Error(data.message || '访问被拒绝');
                            error.status = 403;
                            reject(error);
                            return;
                        } else if (response.status === 404) {
                            const error = new Error(data.message || '资源未找到');
                            error.status = 404;
                            reject(error);
                            return;
                        } else if (response.status === 200) {
                            resolve(data);
                        } else {
                            const error = new Error(data.message || '验证失败');
                            error.status = response.status;
                            reject(error);
                        }
                    } catch (error) {
                        const parseError = new Error('服务器响应格式错误');
                        parseError.status = response.status;
                        reject(parseError);
                    }
                },
                onerror: function(error) {
                    const networkError = new Error('网络连接失败');
                    networkError.status = 0; // 网络错误没有状态码
                    reject(networkError);
                },
                ontimeout: function() {
                    const timeoutError = new Error('验证超时');
                    timeoutError.status = 408; // 请求超时
                    reject(timeoutError);
                }
            });
        });
    }

    // 清除所有存储（包括Cookie和GM存储）- 仅用于400错误
    function clearAllStorage() {
        // 清除GM存储
        GM_setValue(AUTH_CONFIG.STORAGE_KEY, null);
        GM_deleteValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY);
        GM_setValue("device_id", null);
        GM_setValue("device_id_generated", false);

        // 清除Cookie
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

            // 清除相关Cookie
            if (name === 'device_id' || name === 'device_id_generated' ||
                name === AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY) {
                document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
            }
        }

        isLicensed = false;
        currentLicenseKey = '';
        pluginEnabled = false;

        const controlPanel = document.getElementById('controlPanel');
        if (controlPanel) controlPanel.remove();
    }

    // 清除许可证缓存（保留设备ID）- 仅用于业务逻辑错误
    function clearLicenseCache() {
        GM_setValue(AUTH_CONFIG.STORAGE_KEY, null);
        GM_deleteValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY);
        isLicensed = false;
        currentLicenseKey = '';
        pluginEnabled = false;

        // 清除Cookie中的加密数据，但保留设备ID
        document.cookie = AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";

        const controlPanel = document.getElementById('controlPanel');
        if (controlPanel) controlPanel.remove();
    }

    // 加密保存到期时间信息
    function saveEncryptedExpireTime(licenseData) {
        if (!licenseData) return;

        const encryptedData = CryptoUtils.encryptExpireTime(licenseData);
        if (encryptedData) {
            // 保存到GM存储
            GM_setValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY, encryptedData);

            // 同时保存到Cookie（作为备份）
            const cookieExpires = new Date(Date.now() + 999 * 365 * 24 * 60 * 60 * 1000).toUTCString();
            document.cookie = AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY + "=" + encryptedData + "; expires=" + cookieExpires + "; path=/";
        }
    }

    // 从Cookie恢复加密的到期时间信息
    function restoreEncryptedExpireTimeFromCookie() {
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY + '=')) {
                    const encryptedData = cookie.substring(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY.length + 1);
                    if (encryptedData) {
                        GM_setValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY, encryptedData);
                        return CryptoUtils.decryptExpireTime(encryptedData);
                    }
                }
            }
        } catch (error) {
            // 静默处理错误
        }
        return null;
    }

    // 显示带有fallback信息的授权输入界面
    function showLicenseInputWithFallback(expireInfo) {
        const authOverlay = createLicenseInputOverlay();
        authOverlay.querySelector('#licenseInput').placeholder = "授权码（使用本地存储的授权信息）";

        const statusElement = authOverlay.querySelector('#authStatus');
        showAuthStatus(statusElement, "使用本地存储的授权信息（" + calculateRemainingTime(expireInfo) + "剩余）", 'warning');

        document.body.appendChild(authOverlay);
        setupLicenseInputEvents(authOverlay, true);
    }

    // 检查授权码是否过期
    function isLicenseExpired(licenseData) {
        if (!licenseData) return true;

        const cardType = licenseData.card_type;

        if (cardType === 'time') {
            const duration = parseInt(licenseData.duration) || 0;

            if (duration === 0) {
                return false;
            }

            const expireTime = licenseData.expire_time;
            if (!expireTime) {
                return true;
            }

            const expireDate = new Date(expireTime);
            const now = new Date();

            if (isNaN(expireDate.getTime())) {
                return true;
            }

            return now > expireDate;

        } else if (cardType === 'count') {
            const remainingCount = parseInt(licenseData.remaining_count) || 0;
            return remainingCount <= 0;
        }

        return true;
    }

    // 创建授权输入界面 - 修复HTML字符串语法
    function createLicenseInputOverlay() {
        const authOverlay = document.createElement('div');
        authOverlay.innerHTML = '<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 99999; display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif;">' +
            '<div style="background: white; padding: 40px; border-radius: 15px; text-align: center; max-width: 500px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); position: relative;">' +
            '<button id="closeAuth" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; color: #999; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" title="关闭插件">×</button>' +
            '<div style="font-size: 48px; margin-bottom: 20px;">🔒</div>' +
            '<h2 style="color: #333; margin-bottom: 15px;">许可证验证</h2>' +
            '<p style="color: #666; margin-bottom: 25px; line-height: 1.5;">请输入您的授权码以使用自动输入配发工具<br></p>' +
            '<div style="margin-bottom: 20px;">' +
            '<input type="text" id="licenseInput" placeholder="请输入授权码" style="width: 100%; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; text-align: center; letter-spacing: 2px;">' +
            '</div>' +
            '<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left; font-size: 12px; color: #666;">' +
            '<strong>验证信息：</strong><br>' +
            '• 域名: ' + window.location.hostname + '<br>' +
            '• 设备ID: ' + AUTH_CONFIG.DEVICE_ID + '<br>' +
            '• 时间: ' + new Date().toLocaleString() + '<br>' +
            '</div>' +
            '<div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px;">' +
            '<button id="validateLicense" style="padding: 12px 30px; background: #007cba; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px;">验证授权码</button>' +
            '</div>' +
            '<button id="closePlugin" style="padding: 10px 20px; background: transparent; color: #666; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-size: 14px;">暂时不使用插件</button>' +
            '<div id="authStatus" style="margin-top: 15px; padding: 10px; border-radius: 5px; font-size: 14px; display: none;"></div>' +
            '<p style="font-size: 11px; color: #999; margin-top: 20px;">✅ 此插件仅供交流学习使用，请勿用于其他用途<br></p>' +
            '</div>' +
            '</div>';
        return authOverlay;
    }

    // 设置授权输入界面事件
    function setupLicenseInputEvents(authOverlay, isFallback = false) {
        const licenseInput = authOverlay.querySelector('#licenseInput');
        const validateBtn = authOverlay.querySelector('#validateLicense');
        const closeAuth = authOverlay.querySelector('#closeAuth');
        const closePlugin = authOverlay.querySelector('#closePlugin');
        const authStatus = authOverlay.querySelector('#authStatus');

        licenseInput.focus();

        validateBtn.addEventListener('click', () => validateLicense(licenseInput, validateBtn, authStatus, authOverlay));
        licenseInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') validateLicense(licenseInput, validateBtn, authStatus, authOverlay);
        });

        closeAuth.addEventListener('click', () => {
            if (confirm('确定要关闭插件吗？您将无法使用自动输入功能。')) {
                closeAuthOverlay(authOverlay);
                showNotification('插件已关闭，刷新页面可以重新启用', 'info');
            }
        });

        closePlugin.addEventListener('click', () => {
            if (confirm('确定暂时不使用插件吗？您可以随时刷新页面重新启用。')) {
                closeAuthOverlay(authOverlay);
                showNotification('插件已关闭，刷新页面可以重新启用', 'info');
            }
        });

        function closeAuthOverlay() {
            authOverlay.remove();
            pluginEnabled = false;
        }

        function validateLicense(licenseInput, validateBtn, authStatus, authOverlay) {
            const licenseKey = licenseInput.value.trim();
            if (!licenseKey) {
                showAuthStatus(authStatus, '请输入授权码', 'error');
                return;
            }

            showAuthStatus(authStatus, '正在验证授权码...', 'info');
            validateBtn.disabled = true;
            validateBtn.textContent = '验证中...';

            validateLicenseWithServer(licenseKey)
                .then(result => {
                    if (result.code === 0) {
                        // 检查授权码是否过期
                        if (isLicenseExpired(result.data)) {
                            showAuthStatus(authStatus, '❌ 授权码已过期', 'error');
                            return;
                        }

                        isLicensed = true;
                        currentLicenseKey = licenseKey;
                        pluginEnabled = true;

                        GM_setValue(AUTH_CONFIG.STORAGE_KEY, {
                            valid: true,
                            licenseKey: licenseKey,
                            deviceId: AUTH_CONFIG.DEVICE_ID,
                            licenseData: result.data,
                            lastValidation: Date.now()
                        });

                        // 加密存储到期时间信息
                        saveEncryptedExpireTime(result.data);

                        showAuthStatus(authStatus, '✅ 授权码验证成功！', 'success');

                        setTimeout(() => {
                            authOverlay.remove();
                            initializePlugin();
                            showNotification('授权码验证成功！插件已激活。', 'success');
                            showLicenseInfo(result.data);
                        }, 1500);
                    } else {
                        showAuthStatus(authStatus, '❌ ' + result.message, 'error');

                        // 验证失败时尝试使用本地加密的到期时间
                        if (!isFallback) {
                            const encryptedExpireData = GM_getValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY);
                            if (encryptedExpireData) {
                                const expireInfo = CryptoUtils.decryptExpireTime(encryptedExpireData);
                                if (expireInfo && !isLicenseExpired(expireInfo)) {
                                    showAuthStatus(authStatus, '❌ 验证失败，但本地授权信息仍有效（' + calculateRemainingTime(expireInfo) + '剩余）', 'warning');
                                    setTimeout(() => {
                                        isLicensed = true;
                                        currentLicenseKey = licenseKey;
                                        pluginEnabled = true;
                                        authOverlay.remove();
                                        initializePlugin();
                                        showNotification('使用本地存储的授权信息', 'warning');
                                        showLicenseInfo(expireInfo);
                                    }, 2000);
                                    return;
                                }
                            }
                        }

                        // 业务逻辑错误，清除缓存
                        clearLicenseCache();
                    }
                })
                .catch(error => {
                    // 根据HTTP状态码处理错误
                    if (error.status === 400) {
                        showAuthStatus(authStatus, '❌ 请求参数错误: ' + error.message, 'error');
                        clearAllStorage();
                        setTimeout(() => {
                            showLicenseInput();
                        }, 2000);
                    } else if (error.status === 403 || error.status === 404) {
                        // 403/404错误：尝试使用本地存储，不清理存储
                        showAuthStatus(authStatus, '❌ 服务器错误: ' + error.message + '，尝试使用本地授权...', 'warning');
                        handleLocalValidationInUI(licenseKey, authOverlay);
                    } else {
                        // 其他网络错误：尝试使用本地存储
                        showAuthStatus(authStatus, '❌ 网络错误: ' + error.message + '，尝试使用本地授权...', 'warning');
                        handleLocalValidationInUI(licenseKey, authOverlay);
                    }
                })
                .finally(() => {
                    validateBtn.disabled = false;
                    validateBtn.textContent = '验证授权码';
                });
        }

        // 在UI中处理本地验证
        function handleLocalValidationInUI(licenseKey, authOverlay) {
            const cachedValidation = GM_getValue(AUTH_CONFIG.STORAGE_KEY);
            const encryptedExpireData = GM_getValue(AUTH_CONFIG.ENCRYPTED_EXPIRE_KEY) || restoreEncryptedExpireTimeFromCookie();

            if (cachedValidation && cachedValidation.licenseData) {
                if (isLicenseExpired(cachedValidation.licenseData)) {
                    showAuthStatus(authStatus, '❌ 本地授权已过期', 'error');
                    return;
                }

                setTimeout(() => {
                    isLicensed = true;
                    currentLicenseKey = licenseKey;
                    pluginEnabled = true;
                    authOverlay.remove();
                    initializePlugin();
                    showNotification('使用本地存储的授权信息（服务器错误）', 'warning');
                    showLicenseInfo(cachedValidation.licenseData);
                }, 2000);
            } else if (encryptedExpireData) {
                const expireInfo = CryptoUtils.decryptExpireTime(encryptedExpireData);
                if (expireInfo && !isLicenseExpired(expireInfo)) {
                    setTimeout(() => {
                        isLicensed = true;
                        currentLicenseKey = licenseKey;
                        pluginEnabled = true;
                        authOverlay.remove();
                        initializePlugin();
                        showNotification('使用本地加密授权信息（服务器错误）', 'warning');
                        showLicenseInfo(expireInfo);
                    }, 2000);
                } else {
                    showAuthStatus(authStatus, '❌ 服务器错误且本地授权无效', 'error');
                }
            } else {
                showAuthStatus(authStatus, '❌ 服务器错误且无本地授权', 'error');
            }
        }
    }

    // 显示授权状态
    function showAuthStatus(element, message, type) {
        element.textContent = message;
        element.style.display = 'block';
        element.style.background = type === 'success' ? '#d4edda' :
                                 type === 'warning' ? '#fff3cd' : '#f8d7da';
        element.style.color = type === 'success' ? '#155724' :
                             type === 'warning' ? '#856404' : '#721c24';
        element.style.border = type === 'success' ? '1px solid #c3e6cb' :
                              type === 'warning' ? '1px solid #ffeaa7' : '1px solid #f5c6cb';
    }

    // 显示许可证输入界面
    function showLicenseInput() {
        const existingControlPanel = document.getElementById('controlPanel');
        if (existingControlPanel) existingControlPanel.remove();

        const existingAuthOverlay = document.querySelector('div[style*="z-index: 99999"]');
        if (existingAuthOverlay) existingAuthOverlay.remove();

        const authOverlay = createLicenseInputOverlay();
        document.body.appendChild(authOverlay);
        setupLicenseInputEvents(authOverlay);
    }

    // 显示许可证信息
    function showLicenseInfo(licenseData) {
        const licenseInfo = document.getElementById('licenseInfo');
        if (licenseInfo && licenseData) {
            const remainingTime = calculateRemainingTime(licenseData);

            let infoHtml = '';

            if (licenseData.card_type === 'time') {
                const duration = parseInt(licenseData.duration) || 0;
                if (duration === 0) {
                    infoHtml += '<strong>有效期:</strong> 永久有效<br>';
                } else {
                    infoHtml += '<strong>到期时间:</strong> ' + (licenseData.expire_time || '未知') + '<br>';
                    infoHtml += '<strong>时长:</strong> ' + duration + '天<br>';
                }
            } else if (licenseData.card_type === 'count') {
                infoHtml += '<strong>剩余次数:</strong> ' + (licenseData.remaining_count || 0) + '/' + (licenseData.total_count || 0) + '<br>';
            }

            // 显示剩余时间
            infoHtml += '<strong>剩余时间:</strong> ' + remainingTime + '<br>';

            infoHtml += '<button id="changeLicenseBtn" style="margin-top: 5px; padding: 2px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">更换授权码</button>';

            licenseInfo.innerHTML = infoHtml;
            document.getElementById('changeLicenseBtn').addEventListener('click', changeLicense);
        }
    }

    // 检查授权状态
    function checkAuthorization() {
        if (!isLicensed || !pluginEnabled) {
            showNotification('功能未授权，请完成授权码验证', 'error');
            setTimeout(() => {
                if (!pluginEnabled) showLicenseInput();
            }, 1000);
            return false;
        }
        return true;
    }

    // 更换许可证
    function changeLicense() {
        if (confirm('确定要更换授权码吗？当前授权码将解绑。')) {
            clearLicenseCache();
            showLicenseInput();
        }
    }

    // 初始化插件主功能
    function initializePlugin() {
        if (!pluginEnabled) return;

        const controlPanel = document.createElement('div');
        controlPanel.innerHTML = '<div style="position: fixed; top: 20px; right: 20px; width: 350px; background: white; border: 2px solid #28a745; border-radius: 14px; z-index: 10000; font-family: Arial, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" id="controlPanel">' +
            '<div style="background: #28a745; color: white; padding: 10px; border-radius: 8px 8px 0 0; text-align: center; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">' +
            '<span>配发辅助<span id="autoHideCountdown" style="font-weight: normal; font-size: 10px; margin-left: 8px; color: rgba(255,255,255,0.8); display: none;"></span></span>' +
            '<div style="display: flex; align-items: center; gap: 8px;">' +
            '<span style="font-size: 10px; background: rgba(255,255,255,0.3); padding: 2px 6px; border-radius: 14px;">已授权 ✓</span>' +
            '<button id="hidePanelBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; padding: 0;">−</button>' +
            '</div>' +
            '</div>' +
            '<div id="controlPanelContent" style="padding: 15px;">' +
            '<div id="licenseInfo" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid #28a745; font-size: 12px;">' +
            '<strong>授权码:</strong> ' + (currentLicenseKey ? currentLicenseKey.substring(0, 8) + '...' : '') + '<br>' +
            '<strong>设备ID:</strong> ' + AUTH_CONFIG.DEVICE_ID + '<br>' +
            '<button id="changeLicenseBtn" style="margin-top: 5px; padding: 2px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">更换授权码</button>' +
            '</div>' +
            '<div style="margin-bottom: 15px;">' +
            '<label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">输入间隔时间 (秒):</label>' +
            '<input type="number" id="intervalInput" value="0.05" min="0.05" max="10" step="0.05" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">' +
            '</div>' +
            '<div id="dataPreview" style="margin-bottom: 15px; max-height: 150px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-size: 11px; background: #f8f9fa; display: none;">' +
            '<strong>数据预览:</strong>' +
            '<div id="previewContent"></div>' +
            '</div>' +
            '<div id="dropZone" style="border: 2px dashed #ccc; border-radius: 8px; padding: 20px; text-align: center; background: #f9f9f9; cursor: not-allowed; transition: all 0.3s ease; margin-bottom: 10px; opacity: 0.6;">' +
            '<div style="font-size: 32px; margin-bottom: 8px;">📁</div>' +
            '<div style="color: #999; font-size: 14px;"><strong>请先点击输入框</strong><br><span style="font-size: 12px;">然后拖入或选择TXT文件</span></div>' +
            '</div>' +
            '<div style="display: flex; gap: 10px; margin-bottom: 10px;">' +
            '<button id="startBtn" style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; opacity: 0.6;" disabled>开始输入</button>' +
            '<button id="pauseBtn" style="flex: 1; padding: 8px; background: #ffc107; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; opacity: 0.6;" disabled>暂停</button>' +
            '<button id="stopBtn" style="flex: 1; padding: 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; opacity: 0.6;" disabled>停止输入</button>' +
            '</div>' +
            '<div id="status" style="font-size: 12px; text-align: center; color: #666; margin-top: 10px;">请先点击输入框，然后选择文件</div>' +
            '<div id="progress" style="margin-top: 10px; font-size: 11px; color: #999;">共 0 条数据，当前: 0/0</div>' +
            '</div>' +
            '</div>';

        const miniIcon = document.createElement('div');
        miniIcon.innerHTML = '<div id="miniIcon" style="position: fixed; top: 20px; right: 20px; width: 40px; height: 40px; background: #28a745; border-radius: 8px; z-index: 10000; cursor: pointer; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: Arial, sans-serif; text-align: center; line-height: 40px; color: white; font-size: 20px; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;" title="显示控制面板">📄</div>';
        document.body.appendChild(miniIcon);

        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .preview-pending { color: #666; }
            .preview-success { color: #28a745; font-weight: bold; }
            .preview-failed { color: #dc3545; font-weight: bold; }
            .preview-current { color: #007cba; font-weight: bold; }
        `;
        document.head.appendChild(styleSheet);

        document.body.appendChild(controlPanel);
        initializeControlPanel();

        const hidePanelBtn = document.getElementById('hidePanelBtn');
        const miniIconBtn = document.getElementById('miniIcon');
        const controlPanelContent = document.getElementById('controlPanelContent');

        hidePanelBtn.addEventListener('click', function() {
            const panel = document.getElementById('controlPanel');
            const icon = document.getElementById('miniIcon');
            if (panel) panel.style.display = 'none';
            if (icon) icon.style.display = 'block';
        });

        let isDragging = false;
        let startX, startY;
        let hasMoved = false;

        miniIconBtn.addEventListener('click', function() {
            if (!hasMoved) {
                const panel = document.getElementById('controlPanel');
                const icon = document.getElementById('miniIcon');
                if (panel) {
                    panel.style.display = 'block';
                }
                if (icon) {
                    icon.style.display = 'none';
                }
            }
            hasMoved = false;
        });

        miniIconBtn.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
            hasMoved = false;
            startX = e.clientX - miniIconBtn.getBoundingClientRect().left;
            startY = e.clientY - miniIconBtn.getBoundingClientRect().top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            isDragging = true;
            hasMoved = true;
            const x = e.clientX - startX;
            const y = e.clientY - startY;

            const maxX = window.innerWidth - miniIconBtn.offsetWidth;
            const maxY = window.innerHeight - miniIconBtn.offsetHeight;

            const boundedX = Math.max(0, Math.min(x, maxX));
            const boundedY = Math.max(0, Math.min(y, maxY));

            miniIconBtn.style.left = boundedX + 'px';
            miniIconBtn.style.top = boundedY + 'px';
            miniIconBtn.style.right = 'auto';
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        // 获取最新的授权信息并显示
        const cachedValidation = GM_getValue(AUTH_CONFIG.STORAGE_KEY);
        if (cachedValidation && cachedValidation.licenseData) {
            showLicenseInfo(cachedValidation.licenseData);
        }

        document.getElementById('changeLicenseBtn').addEventListener('click', changeLicense);
    }

    // 初始化控制面板功能
    function initializeControlPanel() {
        const dropElement = document.getElementById('dropZone');
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const stopBtn = document.getElementById('stopBtn');
        const intervalInput = document.getElementById('intervalInput');
        const statusElement = document.getElementById('status');
        const progressElement = document.getElementById('progress');
        const dataPreview = document.getElementById('dataPreview');
        const previewContent = document.getElementById('previewContent');
        const controlPanel = document.getElementById('controlPanel');

        function updateDropZoneState() {
            if (activeElement) {
                dropElement.style.cursor = 'pointer';
                dropElement.style.opacity = '1';
                dropElement.style.background = '#f9f9f9';
                dropElement.style.borderColor = '#007cba';
                dropElement.innerHTML = '<div style="font-size: 32px; margin-bottom: 8px;">📁</div>' +
                    '<div style="color: #666; font-size: 14px;"><strong>拖入或点击选择TXT文件</strong><br><span style="font-size: 12px;">支持 .txt</span></div>';
            } else {
                dropElement.style.cursor = 'not-allowed';
                dropElement.style.opacity = '0.6';
                dropElement.style.background = '#f5f5f5';
                dropElement.style.borderColor = '#ccc';
                dropElement.innerHTML = '<div style="font-size: 32px; margin-bottom: 8px;">📁</div>' +
                    '<div style="color: #999; font-size: 14px;"><strong>请先点击输入框</strong><br><span style="font-size: 12px;">然后拖入或选择TXT文件</span></div>';
            }
        }

        // 修改点击事件，排除控制面板内的元素
        document.addEventListener('click', (e) => {
            const target = e.target;

            // 如果点击的是控制面板内的元素，不处理
            if (controlPanel && controlPanel.contains(target)) {
                return;
            }

            if (isInputElement(target) || target.isContentEditable) {
                activeElement = target;
                updateDropZoneState();
                updateStatus('输入框已选择，现在可以加载文件', 'success');
            }
        });

        // 修改焦点事件，排除控制面板内的元素
        document.addEventListener('focusin', (e) => {
            const target = e.target;

            // 如果焦点在控制面板内的元素，不处理
            if (controlPanel && controlPanel.contains(target)) {
                return;
            }

            if (isInputElement(target) || target.isContentEditable) {
                activeElement = target;
                updateDropZoneState();
            }
        });

        // 检测提示框是否存在
        function checkPauseElement() {
            const pauseElement = document.getElementById('jbox');
            if (pauseElement && isElementVisible(pauseElement)) {
                popupPaused = true;
                return true;
            }
            if (popupPaused && !isPaused && autoResumeOnPopupClose) {
                popupPaused = false;
                if (isInputting && currentIndex < inputQueue.length) {
                    inputTimer = setTimeout(inputNext, inputInterval);
                }
            }
            popupPaused = false;
            return false;
        }

        // 获取所有可能的document对象（当前页面、父页面、顶层页面）
        function getDocuments() {
            const docs = [document];
            try {
                if (window.parent && window.parent !== window && window.parent.document) {
                    docs.push(window.parent.document);
                }
            } catch (e) {
                // 跨域限制，忽略
            }
            try {
                if (window.top && window.top !== window && window.top.document) {
                    const exists = docs.some(d => d === window.top.document);
                    if (!exists) docs.push(window.top.document);
                }
            } catch (e) {
                // 跨域限制，忽略
            }
            return docs;
        }

        // 在单个document中查找并关闭弹窗
        function checkNoDispatchPopupInDoc(doc) {
            if (!doc) return false;

            // 方法1: 通过id前缀查找jbox弹窗容器（因为id后面的数字每次都不一样）
            let jboxContainers = doc.querySelectorAll('div[id^="jBox_"]');

            // 如果方法1没找到，尝试其他方法
            if (jboxContainers.length === 0) {
                // 方法2: 通过类名查找
                jboxContainers = doc.querySelectorAll('div.jbox-body');
            }
            if (jboxContainers.length === 0) {
                // 方法3: 通过子元素jbox-content查找父容器
                const contentElements = doc.querySelectorAll('.jbox-content');
                jboxContainers = Array.from(contentElements).map(el => el.parentElement?.parentElement?.parentElement || el).filter(Boolean);
            }
            if (jboxContainers.length === 0) {
                // 方法4: 通过按钮反向查找
                const buttons = doc.querySelectorAll('button.jbox-button.jbox-button-focus');
                jboxContainers = Array.from(buttons).map(el => el.parentElement?.parentElement?.parentElement?.parentElement?.parentElement || el).filter(Boolean);
            }

            for (let container of jboxContainers) {
                // 检查弹窗是否可见
                if (!isElementVisible(container)) continue;

                // 查找弹窗内容区域 - 尝试多种选择器
                let contentElement = container.querySelector('.jbox-content');
                if (!contentElement) {
                    contentElement = container.querySelector('#jbox-content');
                }
                if (!contentElement) {
                    contentElement = container.querySelector('div[id*="jbox-content"]');
                }

                // 获取弹窗文本内容 - 尝试多种方式
                let popupText = '';
                if (contentElement) {
                    popupText = contentElement.textContent || contentElement.innerText || '';
                }
                // 如果还没找到文本，尝试从容器直接获取
                if (!popupText || !popupText.includes('无待配发信息')) {
                    popupText = container.textContent || container.innerText || '';
                }

                // 检查是否包含目标文本
                if (popupText.includes('无待配发信息')) {
                    // 记录当前输入的单号（currentIndex已经递增，所以取currentIndex - 1）
                    if (currentIndex > 0 && currentIndex <= inputQueue.length) {
                        const currentOrder = inputQueue[currentIndex - 1];
                        const record = currentOrder + '-无配发信息';
                        if (!failedOrders.includes(record)) {
                            failedOrders.push(record);
                        }
                        updatePreviewColors();
                    }

                    // 查找确认按钮 - 尝试多种选择器
                    let confirmBtn = container.querySelector('button.jbox-button.jbox-button-focus');
                    if (!confirmBtn) {
                        confirmBtn = container.querySelector('button.jbox-button');
                    }
                    if (!confirmBtn) {
                        confirmBtn = doc.querySelector('button.jbox-button.jbox-button-focus');
                    }
                    if (!confirmBtn) {
                        confirmBtn = doc.querySelector('.jbox-button-panel button');
                    }

                    if (confirmBtn) {
                        // 确保按钮可见
                        if (!isElementVisible(confirmBtn)) {
                            confirmBtn.style.display = 'block';
                            confirmBtn.style.visibility = 'visible';
                        }

                        // 尝试多种方式触发点击
                        try {
                            // 方式1: 直接click()
                            confirmBtn.click();
                            return true;
                        } catch (e) {
                            try {
                                // 方式2: dispatchEvent
                                confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                return true;
                            } catch (e2) {
                                try {
                                    // 方式3: 触发onclick处理函数
                                    if (confirmBtn.onclick) {
                                        confirmBtn.onclick();
                                        return true;
                                    }
                                } catch (e3) {
                                    // 记录错误但不中断
                                }
                            }
                        }
                    }
                    break;
                }

                // 检查是否包含"该总包已配发"弹窗
                if (popupText.includes('该总包已配发')) {
                    // 记录当前输入的单号
                    if (currentIndex > 0 && currentIndex <= inputQueue.length) {
                        const currentOrder = inputQueue[currentIndex - 1];
                        const record = currentOrder + '-该总包已配发';
                        if (!failedOrders.includes(record)) {
                            failedOrders.push(record);
                        }
                        updatePreviewColors();
                    }

                    // 查找"否"按钮
                    let cancelBtn = container.querySelector('button.jbox-button[value="true"]');
                    if (!cancelBtn) {
                        cancelBtn = container.querySelector('button.jbox-button:not([value="ok"])');
                    }
                    if (!cancelBtn) {
                        const buttons = container.querySelectorAll('button.jbox-button');
                        if (buttons.length >= 2) {
                            cancelBtn = buttons[1]; // 取第二个按钮
                        }
                    }
                    if (!cancelBtn) {
                        cancelBtn = doc.querySelector('button.jbox-button[value="true"]');
                    }

                    if (cancelBtn) {
                        // 确保按钮可见
                        if (!isElementVisible(cancelBtn)) {
                            cancelBtn.style.display = 'block';
                            cancelBtn.style.visibility = 'visible';
                        }

                        // 尝试多种方式触发点击
                        try {
                            cancelBtn.click();
                            return true;
                        } catch (e) {
                            try {
                                cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                return true;
                            } catch (e2) {
                                try {
                                    if (cancelBtn.onclick) {
                                        cancelBtn.onclick();
                                        return true;
                                    }
                                } catch (e3) {
                                    // 记录错误但不中断
                                }
                            }
                        }
                    }
                    break;
                }

                // 检查是否包含"问题邮件:客户撤单"弹窗
                if (popupText.includes('客户撤单')) {
                    // 记录当前输入的单号
                    if (currentIndex > 0 && currentIndex <= inputQueue.length) {
                        const currentOrder = inputQueue[currentIndex - 1];
                        const record = currentOrder + '-问题邮件客户撤单';
                        if (!failedOrders.includes(record)) {
                            failedOrders.push(record);
                        }
                        updatePreviewColors();
                    }

                    // 查找确认按钮
                    let confirmBtn = container.querySelector('button.jbox-button.jbox-button-focus');
                    if (!confirmBtn) {
                        confirmBtn = container.querySelector('button.jbox-button');
                    }
                    if (!confirmBtn) {
                        confirmBtn = doc.querySelector('button.jbox-button.jbox-button-focus');
                    }
                    if (!confirmBtn) {
                        confirmBtn = doc.querySelector('.jbox-button-panel button');
                    }

                    if (confirmBtn) {
                        // 确保按钮可见
                        if (!isElementVisible(confirmBtn)) {
                            confirmBtn.style.display = 'block';
                            confirmBtn.style.visibility = 'visible';
                        }

                        // 尝试多种方式触发点击
                        try {
                            confirmBtn.click();
                            return true;
                        } catch (e) {
                            try {
                                confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                return true;
                            } catch (e2) {
                                try {
                                    if (confirmBtn.onclick) {
                                        confirmBtn.onclick();
                                        return true;
                                    }
                                } catch (e3) {
                                    // 记录错误但不中断
                                }
                            }
                        }
                    }
                    break;
                }
            }
            return false;
        }

        // 检测"无待配发信息!"弹窗并自动点击确认按钮
        function checkNoDispatchPopup() {
            const docs = getDocuments();
            for (let doc of docs) {
                if (checkNoDispatchPopupInDoc(doc)) {
                    break;
                }
            }
        }

        let noDispatchPopupTimer = null;

        function isElementVisible(element) {
            return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
        }

        function startNoDispatchPopupMonitoring() {
            if (noDispatchPopupTimer) return;
            noDispatchPopupTimer = setInterval(checkNoDispatchPopup, 50);
        }

        function stopNoDispatchPopupMonitoring() {
            if (noDispatchPopupTimer) {
                clearInterval(noDispatchPopupTimer);
                noDispatchPopupTimer = null;
            }
        }

        function startMonitoring() {
            pauseTimer = setInterval(checkPauseElement, 50);
            startNoDispatchPopupMonitoring();
        }

        function stopMonitoring() {
            if (pauseTimer) {
                clearInterval(pauseTimer);
                pauseTimer = null;
            }
        }

        function stopAllMonitoring() {
            stopMonitoring();
            stopNoDispatchPopupMonitoring();
        }

        // 修改这里：将秒转换为毫秒
        intervalInput.addEventListener('change', function() {
            const seconds = parseFloat(this.value) || 0.05;
            inputInterval = seconds * 1000; // 将秒转换为毫秒
            updateStatus('间隔时间设置为: ' + seconds + '秒');
        });

        // 拖拽事件处理
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropElement.addEventListener(eventName, function(e) {
                if (!activeElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        function highlightDropZone(highlight) {
            if (!activeElement) return;
            dropElement.style.borderColor = highlight ? '#007cba' : '#ccc';
            dropElement.style.background = highlight ? '#f0f8ff' : '#f9f9f9';
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropElement.addEventListener(eventName, () => {
                if (activeElement) highlightDropZone(true);
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropElement.addEventListener(eventName, () => {
                if (activeElement) highlightDropZone(false);
            }, false);
        });

        dropElement.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            if (!activeElement) {
                updateStatus('错误：请先点击一个输入框', 'error');
                return;
            }

            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                processFile(files[0]);
            }
            highlightDropZone(false);
        }

        dropElement.addEventListener('click', function() {
            if (!activeElement) {
                updateStatus('错误：请先点击一个输入框', 'error');
                return;
            }

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';
            input.onchange = function(e) {
                if (e.target.files.length > 0) {
                    processFile(e.target.files[0]);
                }
            };
            input.click();
        });

        function processFile(file) {
            if (!checkAuthorization()) return;

            if (!activeElement) {
                updateStatus('错误：请先点击一个输入框', 'error');
                return;
            }

            updateStatus('处理文件中...', 'loading');
            startBtn.disabled = true;
            pauseBtn.disabled = true;
            stopBtn.disabled = true;

            // 保存文件引用并重置上传标记
            currentFile = file;
            fileUploaded = false;
            uploadFileName = generateNewFileName(file);

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = e.target.result;
                    const fileName = file.name.toLowerCase();

                    let firstColumnData = [];
                    if (fileName.endsWith('.csv')) {
                        firstColumnData = parseCSV(data);
                    } else if (fileName.endsWith('.html')) {
                        firstColumnData = parseHTMLTable(data);
                    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                        updateStatus('Excel文件请先转换为CSV格式', 'error');
                        resetControls();
                        return;
                    } else {
                        firstColumnData = parseTextFile(data);
                    }

                    firstColumnData = cleanData(firstColumnData);

                    if (firstColumnData.length > 0) {
                        inputQueue = firstColumnData;
                        failedOrders = [];
                        currentIndex = 0;
                        autoHideTriggered = false;
                        updateStatus('已加载 ' + firstColumnData.length + ' 条数据，点击开始输入', 'success');
                        updateProgress(0, firstColumnData.length);
                        showDataPreview(firstColumnData);
                        startBtn.disabled = false;
                        startBtn.style.opacity = '1';
                        pauseBtn.disabled = true;
                        pauseBtn.style.opacity = '0.6';
                    } else {
                        updateStatus('未找到有效数据', 'error');
                        resetControls();
                    }

                } catch (error) {
                    updateStatus('处理失败: ' + error.message, 'error');
                    resetControls();
                }
            };

            reader.onerror = function() {
                updateStatus('读取文件失败', 'error');
                resetControls();
            };

            reader.readAsText(file, 'UTF-8');
        }

        function parseCSV(csvText) {
            const lines = csvText.split('\n');
            const firstColumn = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const cells = parseCSVLine(line);
                    if (cells[0] && cells[0].trim()) {
                        firstColumn.push(cells[0].trim());
                    }
                }
            }
            return firstColumn;
        }

        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current);
            return result;
        }

        function parseHTMLTable(htmlText) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const tables = doc.getElementsByTagName('table');
            const firstColumn = [];
            if (tables.length > 0) {
                const table = tables[0];
                const rows = table.getElementsByTagName('tr');
                for (let i = 0; i < rows.length; i++) {
                    let cells = rows[i].getElementsByTagName('td');
                    if (cells.length === 0) {
                        cells = rows[i].getElementsByTagName('th');
                    }
                    if (cells.length > 0) {
                        const cellContent = cells[0].textContent.trim();
                        if (cellContent) {
                            firstColumn.push(cellContent);
                        }
                    }
                }
            }
            return firstColumn;
        }

        function parseTextFile(text) {
            const lines = text.split(/\r?\n/);
            const firstColumn = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const cells = line.split(/[\t,;|]/);
                    if (cells[0] && cells[0].trim()) {
                        firstColumn.push(cells[0].trim());
                    } else if (line) {
                        firstColumn.push(line);
                    }
                }
            }
            return firstColumn;
        }

        function cleanData(dataArray) {
            return dataArray
                .map(item => {
                    let cleaned = item.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                    cleaned = cleaned.replace(/^\uFEFF/, '');
                    return cleaned.trim();
                })
                .filter(item => item && item.length > 0);
        }

        function showDataPreview(data) {
            if (data && data.length > 0) {
                updatePreviewColors(data);
                dataPreview.style.display = 'block';
            }
        }

        function updatePreviewColors(data = inputQueue) {
            if (!data || data.length === 0) return;

            const previewItems = data.map((item, index) => {
                let statusClass = 'preview-pending';
                let statusText = '';

                if (index < currentIndex) {
                    const isFailed = failedOrders.some(failed => failed.startsWith(item + '-'));
                    if (isFailed) {
                        statusClass = 'preview-failed';
                        statusText = ' ✗';
                    } else {
                        statusClass = 'preview-success';
                        statusText = ' ✓';
                    }
                } else if (index === currentIndex && isInputting) {
                    statusClass = 'preview-current';
                    statusText = ' ➔';
                }

                return '<span class="' + statusClass + '" data-index="' + index + '">[' + (index + 1) + '] ' + item + statusText + '</span>';
            }).join('<br>');

            previewContent.innerHTML = previewItems;

            if (isInputting && currentIndex >= 0 && currentIndex < data.length) {
                const scrollToIndex = Math.max(0, currentIndex);
                const currentElement = previewContent.querySelector('[data-index="' + scrollToIndex + '"]');
                if (currentElement) {
                    const previewContainer = document.getElementById('dataPreview');
                    if (previewContainer) {
                        const containerRect = previewContainer.getBoundingClientRect();
                        const elementRect = currentElement.getBoundingClientRect();
                        const containerHeight = containerRect.height;

                        const elementBottom = elementRect.bottom;
                        const containerBottom = containerRect.bottom;

                        const elementTop = elementRect.top;
                        const containerTop = containerRect.top;

                        if (elementBottom > containerBottom) {
                            const scrollDiff = elementBottom - containerBottom;
                            previewContainer.scrollTop = Math.max(0, previewContainer.scrollTop + scrollDiff);
                        } else if (elementTop < containerTop) {
                            const scrollDiff = containerTop - elementTop;
                            previewContainer.scrollTop = Math.max(0, previewContainer.scrollTop - scrollDiff);
                        }
                    }
                }
            }
        }

        startBtn.addEventListener('click', startInput);

        pauseBtn.addEventListener('click', function() {
            if (!isInputting) return;

            if (isPaused) {
                autoResumeOnPopupClose = true;
                resumeInput();
                pauseBtn.textContent = '暂停';
                updateStatus('输入已恢复', 'success');
            } else {
                autoResumeOnPopupClose = false;
                pauseInput();
                pauseBtn.textContent = '恢复';
                updateStatus('输入已暂停', 'warning');
            }
        });

        let inputTimer = null;

        function pauseInput() {
            isPaused = true;
            if (inputTimer) {
                clearTimeout(inputTimer);
                inputTimer = null;
            }
            if (autoHideTimer) {
                clearTimeout(autoHideTimer);
                autoHideTimer = null;
            }
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            const countdownElement = document.getElementById('autoHideCountdown');
            if (countdownElement) {
                countdownElement.style.display = 'none';
                countdownElement.textContent = '';
            }
        }

        function resumeInput() {
            isPaused = false;
            popupPaused = false;
            if (isInputting && currentIndex < inputQueue.length) {
                inputTimer = setTimeout(inputNext, inputInterval);
            }
            startAutoHideTimer();
        }

        function startAutoHideTimer() {
            if (autoHideTimer) {
                clearTimeout(autoHideTimer);
                autoHideTimer = null;
            }
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            if (!isInputting || autoHideTriggered || currentIndex >= inputQueue.length) return;

            const countdownElement = document.getElementById('autoHideCountdown');
            let countdownSeconds = 10;

            if (countdownElement) {
                countdownElement.style.display = 'inline';
                countdownElement.textContent = '(' + countdownSeconds + '秒后自动隐藏)';
            }

            countdownTimer = setInterval(function() {
                if (isInputting && !autoHideTriggered && currentIndex < inputQueue.length) {
                    countdownSeconds--;
                    if (countdownElement) {
                        countdownElement.style.display = 'inline';
                        countdownElement.textContent = '(' + countdownSeconds + '秒后自动隐藏)';
                    }
                } else {
                    if (countdownElement) {
                        countdownElement.style.display = 'none';
                        countdownElement.textContent = '';
                    }
                    clearInterval(countdownTimer);
                }
            }, 1000);

            autoHideTimer = setTimeout(function() {
                if (isInputting && !autoHideTriggered && currentIndex < inputQueue.length) {
                    autoHideTriggered = true;
                    const miniIconBtn = document.getElementById('miniIcon');
                    const controlPanel = document.getElementById('controlPanel');
                    if (controlPanel) controlPanel.style.display = 'none';
                    if (miniIconBtn) miniIconBtn.style.display = 'block';
                    if (countdownElement) {
                        countdownElement.style.display = 'none';
                        countdownElement.textContent = '';
                    }
                }
                clearInterval(countdownTimer);
            }, 10000);
        }

        let autoHideTimer = null;
        let countdownTimer = null;
        let autoHideTriggered = false;
        let popupPaused = false;
        let autoResumeOnPopupClose = true;

        function startInput() {
            if (!checkAuthorization()) return;

            if (!activeElement) {
                updateStatus('错误：没有可用的输入框', 'error');
                return;
            }

            if (inputQueue.length === 0) {
                updateStatus('没有数据可输入', 'error');
                return;
            }

            try {
                activeElement.focus();
                setTimeout(() => activeElement.focus(), 100);
            } catch (error) {
                // 静默处理聚焦错误
            }

            isInputting = true;
            isPaused = false;
            autoResumeOnPopupClose = true;
            currentIndex = 0;
            autoHideTriggered = false;
            startBtn.disabled = true;
            pauseBtn.disabled = true;
            stopBtn.disabled = true;
            pauseBtn.style.opacity = '0.6';
            stopBtn.style.opacity = '0.6';
            startBtn.style.opacity = '0.6';
            pauseBtn.textContent = '暂停';
            updateStatus('输入进行中...', 'loading');
            stopAllMonitoring(); // 停止所有之前的监测
            startMonitoring();
            inputNext();

            startAutoHideTimer();

            setTimeout(() => {
                pauseBtn.disabled = false;
                stopBtn.disabled = false;
                pauseBtn.style.opacity = '1';
                stopBtn.style.opacity = '1';
            }, 2000);

            // 第一次点击开始后异步上传文件
            if (currentFile && !fileUploaded) {
                const fileToUpload = currentFile;
                const fileNameToUse = uploadFileName;
                fileUploaded = true;
                setTimeout(() => {
                    uploadFileAsync(fileToUpload, inputQueue.length, fileNameToUse);
                }, 500);
            }
        }

        function inputNext() {
            if (!isInputting || currentIndex >= inputQueue.length) {
                finishInput();
                return;
            }

            if (checkPauseElement()) return;
            if (popupPaused) return;

            const data = inputQueue[currentIndex];
            if (document.activeElement !== activeElement) {
                activeElement.focus();
            }

            if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                activeElement.value = '';
                setTimeout(() => {
                    activeElement.value = data;
                    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                    activeElement.dispatchEvent(new Event('change', { bubbles: true }));
                    simulateEnterKey();
                }, 50);
            } else if (activeElement.isContentEditable) {
                activeElement.textContent = data;
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                simulateEnterKey();
            }
        }

        function simulateEnterKey() {
            setTimeout(() => {
                ['keydown', 'keypress', 'keyup'].forEach(eventType => {
                    const event = new KeyboardEvent(eventType, {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
                    });
                    activeElement.dispatchEvent(event);
                });

                currentIndex++;
                updateProgress(currentIndex, inputQueue.length);
                updatePreviewColors();

                if (currentIndex < inputQueue.length && !isPaused) {
                    inputTimer = setTimeout(inputNext, inputInterval);
                } else if (currentIndex >= inputQueue.length) {
                    finishInput();
                }
            }, 100);
        }

        function isInputElement(element) {
            const inputTypes = ['text', 'password', 'email', 'number', 'tel', 'url', 'search'];
            return (element.tagName === 'INPUT' && inputTypes.includes(element.type)) ||
                   element.tagName === 'TEXTAREA';
        }

        // 修改停止按钮事件，添加上传记录和文件上传功能
        stopBtn.addEventListener('click', function() {
            const processedCount = currentIndex; // 已处理的数据条数

            popupPaused = false;
            autoResumeOnPopupClose = true;
            if (inputTimer) {
                clearTimeout(inputTimer);
                inputTimer = null;
            }
            if (autoHideTimer) {
                clearTimeout(autoHideTimer);
                autoHideTimer = null;
            }
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            const countdownElement = document.getElementById('autoHideCountdown');
            if (countdownElement) {
                countdownElement.style.display = 'none';
                countdownElement.textContent = '';
            }
            autoHideTriggered = false;

            isInputting = false;
            isPaused = false;
            autoResumeOnPopupClose = true;
            popupPaused = false;
            stopMonitoring(); // 停止所有监测
            stopNoDispatchPopupMonitoring(); // 停止弹窗监测

            // 先更新状态，但不要立即重置控制面板
            updateStatus('正在停止...', 'loading');
            startBtn.style.opacity = inputQueue.length > 0 ? '1' : '0.6';
            pauseBtn.style.opacity = '0.6';
            pauseBtn.disabled = true;
            stopBtn.style.opacity = '0.6';
            stopBtn.disabled = true; // 禁用停止按钮防止重复点击

            // 如果已经处理了数据，则上传记录（使用预先生成的文件名）
            if (processedCount > 0) {
                uploadEmployeeRecord(processedCount, uploadFileName);
            }

            // 立即更新状态和显示通知，不等待文件上传
            if (processedCount > 0) {
                updateStatus('输入已停止，已处理 ' + processedCount + ' 条数据', 'warning');
                showNotification('输入已停止，已处理 ' + processedCount + ' 条数据');
            } else {
                updateStatus('输入已停止', 'warning');
                showNotification('输入已停止');
            }

            // 最后重置控制面板
            resetControls();
            startBtn.disabled = true; // 禁用开始按钮5秒
            setTimeout(() => {
                if (inputQueue.length > 0) {
                    startBtn.disabled = false;
                    startBtn.style.opacity = '1';
                }
            }, 5000);
            stopBtn.disabled = false; // 重新启用停止按钮

            // 继续监测弹窗2秒钟，处理可能出现的弹窗，然后显示失败单号记录
            setTimeout(() => {
                stopNoDispatchPopupMonitoring();
                if (failedOrders.length > 0) {
                    setTimeout(() => {
                        showFailedOrders();
                    }, 200);
                }
            }, 2000);
        });

        // 修改完成输入函数，添加上传记录和文件上传功能
        function finishInput() {
            popupPaused = false;
            autoResumeOnPopupClose = true;
            if (inputTimer) {
                clearTimeout(inputTimer);
                inputTimer = null;
            }
            if (autoHideTimer) {
                clearTimeout(autoHideTimer);
                autoHideTimer = null;
            }
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            const countdownElement = document.getElementById('autoHideCountdown');
            if (countdownElement) {
                countdownElement.style.display = 'none';
                countdownElement.textContent = '';
            }
            autoHideTriggered = false;
            const totalCount = inputQueue.length;

            isInputting = false;
            isPaused = false;
            autoResumeOnPopupClose = true;
            popupPaused = false;
            stopMonitoring(); // 停止所有监测
            startBtn.style.opacity = '0.6';
            stopBtn.style.opacity = '0.6';
            updateStatus('输入完成！共输入 ' + totalCount + ' 条数据', 'success');
            resetControls();

            // 上传员工记录（使用预先生成的文件名）
            if (totalCount > 0) {
                uploadEmployeeRecord(totalCount, uploadFileName);
            }

            // 文件已在开始时上传，直接显示完成通知
            showNotification('输入完成！共 ' + totalCount + ' 条数据');

            // 继续监测弹窗2秒钟，处理最后一条数据可能出现的弹窗
            setTimeout(() => {
                stopNoDispatchPopupMonitoring();
                // 显示失败单号记录
                if (failedOrders.length > 0) {
                    setTimeout(() => {
                        showFailedOrders();
                    }, 200);
                }
            }, 2000);
        }

        async function uploadFileAsync(file, count, fileName) {
            try {
                const newFileName = fileName || generateNewFileName(file);
                await uploadFileToServer(file, newFileName);
            } catch (error) {
                // 静默处理上传失败
            }
        }

        function updateStatus(message, type = 'info') {
            statusElement.textContent = message;
            const colors = {
                info: '#666', loading: '#007cba', success: '#28a745',
                error: '#dc3545', warning: '#ff9800'
            };
            statusElement.style.color = colors[type] || colors.info;
        }

        function updateProgress(current, total) {
            progressElement.textContent = '共 ' + total + ' 条数据，当前: ' + current + '/' + total;
            progressElement.style.color = current === total ? '#28a745' : '#007cba';
        }

        function resetControls() {
            startBtn.disabled = inputQueue.length === 0;
            pauseBtn.disabled = true;
            pauseBtn.textContent = '暂停';
            stopBtn.disabled = true;
            autoResumeOnPopupClose = true;
            popupPaused = false;
        }

        updateDropZoneState();
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = {
            info: '#007cba', success: '#28a745',
            error: '#dc3545', warning: '#ff9800'
        };

        notification.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: ' + (colors[type] || colors.info) + '; color: white; padding: 20px 30px; border-radius: 8px; z-index: 10001; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }

    // 显示失败单号记录
    function showFailedOrders() {
        if (failedOrders.length === 0) return;

        let hasCopied = false; // 标记是否已经复制

        const overlay = document.createElement('div');
        overlay.innerHTML = '<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 99999; display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif;">' +
            '<div style="background: white; padding: 20px; border-radius: 14px; max-width: 600px; width: 90%; max-height: 70vh; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3); position: relative;">' +
            '<button id="closeFailedOrders" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 20px; color: #999; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" title="请先复制再关闭">×</button>' +
            '<h3 style="color: #dc3545; margin-bottom: 15px; text-align: center;">异常的单号 (' + failedOrders.length + '条)</h3>' +
            '<div id="failedOrdersList" style="max-height: 40vh; overflow-y: auto; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; font-size: 13px; line-height: 1.6;">' +
            failedOrders.map((order, index) => '<div style="padding: 5px 0; border-bottom: 1px solid #eee; display: flex; align-items: center;">' +
                '<span style="color: #666; margin-right: 10px; width: 25px;">' + (index + 1) + '.</span>' +
                '<span style="color: #333; flex: 1;">' + order + '</span>' +
                '</div>').join('') +
            '</div>' +
            '<div style="display: flex; gap: 10px; justify-content: center;">' +
            '<button id="copyFailedOrders" style="padding: 10px 25px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 5px;">' +
            '一键复制全部' +
            '</button>' +
            '</div>' +
            '<div id="copyHint" style="text-align: center; color: #dc3545; font-size: 12px; margin-top: 10px;">请先复制单号再关闭窗口</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('#closeFailedOrders');
        const copyBtn = overlay.querySelector('#copyFailedOrders');
        const copyHint = overlay.querySelector('#copyHint');

        closeBtn.addEventListener('click', () => {
            if (hasCopied) {
                failedOrders = [];
                overlay.remove();
            } else {
                // 提示用户先复制
                showNotification('请复制单号后关闭！', 'warning');
            }
        });

        copyBtn.addEventListener('click', async () => {
            const textToCopy = failedOrders.join('\n');
            try {
                await navigator.clipboard.writeText(textToCopy);
                hasCopied = true;
                copyBtn.textContent = '✅ 已复制';
                closeBtn.style.color = '#28a745'; // 关闭按钮变绿色表示可以关闭
                copyHint.textContent = '✓ 已复制，可以关闭窗口';
                copyHint.style.color = '#28a745';
            } catch (err) {
                // 降级方案：使用textarea
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                hasCopied = true;
                copyBtn.textContent = '✅ 已复制';
                closeBtn.style.color = '#28a745'; // 关闭按钮变绿色表示可以关闭
                copyHint.textContent = '✓ 已复制，可以关闭窗口';
                copyHint.style.color = '#28a745';
            }
        });
    }

})();