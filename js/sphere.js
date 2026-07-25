export class PlanetSphere {
    constructor(canvas, landmarks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.landmarks = landmarks;
        this.activeLandmarkName = null;
        
        this.radius = 150;
        this.rotationY = 0;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    }

    highlightLandmark(name) {
        this.activeLandmarkName = name;
    }

    // 將經緯度轉換為 3D 笛卡爾座標
    get3DPoint(lat, lon, radius) {
        // 將字串轉為浮點數並轉為弧度
        const latRad = (parseFloat(lat) * Math.PI) / 180;
        const lonRad = (parseFloat(lon) * Math.PI) / 180;

        // 球面座標轉 3D 直角座標
        const x = radius * Math.cos(latRad) * Math.sin(lonRad);
        const y = radius * Math.sin(latRad) * -1; // Y軸反轉以符合螢幕座標系
        const z = radius * Math.cos(latRad) * Math.cos(lonRad);
        
        return { x, y, z };
    }

    // Y 軸旋轉矩陣
    rotateY(point, angle) {
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        return {
            x: point.x * cosA - point.z * sinA,
            y: point.y,
            z: point.x * sinA + point.z * cosA
        };
    }

    animate() {
        if (!this.canvas.isConnected) return; // 如果節點被移除則停止動畫

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        this.rotationY += 0.005; // 球體自轉速度

        // 繪製基礎全息球體背景 (光暈)
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, this.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // 繪製赤道與經線示意 (簡化網格)
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, this.radius, this.radius * 0.3, 0, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, this.radius * 0.3, this.radius, 0, 0, Math.PI * 2);
        this.ctx.stroke();

        // 繪製地標點
        this.landmarks.forEach(lm => {
            const rawPoint = this.get3DPoint(lm['緯度'] || 0, lm['經度'] || 0, this.radius);
            const rotatedPoint = this.rotateY(rawPoint, this.rotationY);
            
            // 投影至 2D 螢幕
            const screenX = cx + rotatedPoint.x;
            const screenY = cy + rotatedPoint.y;

            // 判斷點在球體正面還是背面 (Z > 0 在正面)
            const isFront = rotatedPoint.z > 0;
            const isActive = lm.name === this.activeLandmarkName;

            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, isActive ? 6 : 3, 0, Math.PI * 2);
            
            if (isActive) {
                this.ctx.fillStyle = isFront ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
                this.ctx.shadowColor = '#00f0ff';
                this.ctx.shadowBlur = 10;
            } else {
                this.ctx.fillStyle = isFront ? '#00f0ff' : 'rgba(0, 240, 255, 0.2)';
                this.ctx.shadowBlur = 0;
            }
            
            this.ctx.fill();
            
            // 繪製地標名稱標籤 (僅正面且被選中時顯示)
            if (isActive && isFront) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '12px "Share Tech Mono"';
                this.ctx.fillText(lm.name, screenX + 10, screenY - 10);
                
                // 畫連接線
                this.ctx.beginPath();
                this.ctx.moveTo(screenX, screenY);
                this.ctx.lineTo(screenX + 8, screenY - 8);
                this.ctx.strokeStyle = '#00f0ff';
                this.ctx.stroke();
            }
        });
        
        this.ctx.shadowBlur = 0; // 重置陰影避免影響下一幀

        requestAnimationFrame(this.animate);
    }
}