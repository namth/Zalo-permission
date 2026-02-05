# 🌐 Cấu Hình Domain cho API

## Tổng Quan

Bạn có API chạy trên `localhost:3000`, muốn truy cập via `your-domain.com`

**Architecture:**
```
your-domain.com (port 80/443)
         ↓
    Nginx Reverse Proxy
         ↓
    localhost:3000 (API)
```

---

## 📋 Bước 1: Chuẩn Bị Domain

### **DNS Records**
Đăng nhập vào nhà cung cấp domain (Godaddy, Namecheap, etc):

1. Tìm DNS records của domain
2. Thêm A record:
   - **Type:** A
   - **Name:** @ (hoặc để trống)
   - **Value:** `your_server_ip`
   - **TTL:** 3600

**Hoặc subdomain:**
- **Type:** A
- **Name:** api
- **Value:** `your_server_ip`
- → Truy cập via `api.your-domain.com`

**Kiểm tra DNS:**
```bash
nslookup your-domain.com
# hoặc
dig your-domain.com
```

---

## 🔧 Bước 2: Setup Nginx

### **2.1 Cài Nginx trên Server**

```bash
# SSH vào server
ssh root@your_server_ip

# Cài Nginx
dnf install -y nginx

# Khởi động
systemctl start nginx
systemctl enable nginx

# Kiểm tra
nginx -v
```

### **2.2 Tạo Nginx Config**

```bash
# Tạo file config
cat > /etc/nginx/conf.d/zalo-api.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # API location
    location / {
        proxy_pass http://localhost:3000;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffers
        proxy_buffering off;
    }
}
EOF
```

**Thay thế:**
- `your-domain.com` → Domain thực của bạn (e.g., `api.myapp.com`)
- `www.your-domain.com` → Optional

### **2.3 Test Config**

```bash
# Kiểm tra syntax
nginx -t

# Nếu OK, reload
systemctl reload nginx
```

### **2.4 Test Kết Nối**

```bash
# From server
curl http://localhost/api/health

# From local
curl http://your-domain.com/api/health
```

---

## 🔒 Bước 3: Setup SSL/HTTPS (Recommended)

### **3.1 Cài Certbot**

```bash
dnf install -y certbot python3-certbot-nginx
```

### **3.2 Generate Certificate**

```bash
# Method 1: Automatic (Nginx handles it)
certbot --nginx -d your-domain.com -d www.your-domain.com

# Method 2: Standalone (if Nginx not ready)
certbot certonly --standalone -d your-domain.com
```

**Certbot sẽ:**
- Tạo certificate letsencrypt
- Tự động cập nhật Nginx config
- Setup auto-renewal

### **3.3 Verify HTTPS**

```bash
curl https://your-domain.com/api/health
```

### **3.4 Auto-Renewal Setup**

```bash
# Enable auto-renewal
systemctl enable certbot-renew.timer

# Check status
systemctl status certbot-renew.timer

# Manual renewal (test)
certbot renew --dry-run
```

---

## 📝 Nginx Config Chi Tiết

### **Full Config with HTTP→HTTPS Redirect**

```bash
cat > /etc/nginx/conf.d/zalo-api.conf << 'EOF'
# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    return 301 https://$server_name$request_uri;
}

# HTTPS - Main API
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL Certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # API Proxy
    location / {
        proxy_pass http://localhost:3000;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_buffering off;
    }
    
    # Optional: Enable gzip compression
    gzip on;
    gzip_types application/json;
    gzip_min_length 1000;
}
EOF
```

---

## 🚀 Full Deployment Sequence

### **Bước 1: Chuẩn Bị Server**

```bash
ssh root@your_server_ip

# Update system
dnf update -y

# Cài Docker
dnf install -y docker docker-compose nginx certbot python3-certbot-nginx

# Start services
systemctl start docker
systemctl enable docker
```

### **Bước 2: Deploy API Code**

```bash
mkdir -p /opt/zalo-permission
cd /opt/zalo-permission

# Clone code
git clone https://github.com/your-repo/zalo-permission.git .

# Setup .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password
DATABASE_URL=postgres://plutusr:ccbbndctdkhmbddn@postgres:5432/plutusdb
EOF

# Start Docker
docker-compose up -d

# Wait for services
sleep 15

# Initialize data
bash backend/scripts/init-data.sh

# Verify API
curl http://localhost:3000/api/health
```

### **Bước 3: Setup Nginx + SSL**

```bash
# Create Nginx config (HTTP only first)
cat > /etc/nginx/conf.d/zalo-api.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Test config
nginx -t

# Reload
systemctl reload nginx

# Verify HTTP works
curl http://your-domain.com/api/health

# Generate SSL Certificate (Certbot auto-updates config)
certbot --nginx -d your-domain.com -d www.your-domain.com

# Verify HTTPS
curl https://your-domain.com/api/health
```

### **Bước 4: Setup Auto-Renewal**

```bash
systemctl enable certbot-renew.timer
systemctl status certbot-renew.timer
```

---

## 🔍 Troubleshooting

| Lỗi | Giải Pháp |
|-----|----------|
| `curl: (7) Failed to connect` | Kiểm tra firewall, DNS records, Nginx status |
| `DNS_PROBE_FINISHED_NXDOMAIN` | DNS records chưa cập nhật (đợi 24h) |
| `SSL error` | `certbot renew`, kiểm tra `/etc/letsencrypt/` |
| `502 Bad Gateway` | API không chạy: `docker-compose ps` |
| `Connection refused` | Nginx không connect port 3000 |

**Debug:**
```bash
# Check Nginx status
systemctl status nginx
tail -f /var/log/nginx/error.log

# Check Docker
docker-compose ps
docker logs -f plutus-workspace-api

# Check firewall
firewall-cmd --list-ports
firewall-cmd --add-port=80/tcp --permanent
firewall-cmd --add-port=443/tcp --permanent
firewall-cmd --reload
```

---

## ✅ Verification Checklist

```bash
# 1. DNS working
nslookup your-domain.com

# 2. API running
curl http://localhost:3000/api/health

# 3. Nginx running
systemctl status nginx

# 4. HTTP accessible
curl http://your-domain.com/api/health

# 5. HTTPS accessible
curl https://your-domain.com/api/health

# 6. SSL valid
curl -I https://your-domain.com/api/health
# → Should show SSL cert info
```

---

## 📊 Final Architecture

```
Internet
   ↓
your-domain.com:443 (HTTPS)
   ↓
Nginx Reverse Proxy (:443 → :80 redirect)
   ↓
localhost:3000 (API)
   ↓
┌─────────────────────────┐
│  Docker Compose         │
├─────────────────────────┤
│ ✓ PostgreSQL (:5432)    │
│ ✓ Neo4j (:7687)         │
│ ✓ API (:3000)           │
└─────────────────────────┘
```

---

## 🎯 Quick Commands

```bash
# View Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Reload Nginx after config change
systemctl reload nginx

# Check SSL expiration
curl -I https://your-domain.com | grep SSL

# Manual SSL renewal
certbot renew --force-renewal

# Restart everything
systemctl restart docker
systemctl restart nginx
```

---

**Kết quả cuối cùng:**
- ✅ `https://your-domain.com/api/health` → Trả về API response
- ✅ HTTP tự redirect sang HTTPS
- ✅ SSL auto-renew hàng tháng
- ✅ Ready for production 🚀
