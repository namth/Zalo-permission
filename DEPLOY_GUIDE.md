# 🚀 Hướng Dẫn Deploy lên Server

## Tùy Chọn Deploy

### **Option 1: Fresh Deploy (Recommended)** ✅
Nếu server mới hoặc không cần data cũ

### **Option 2: Migrate Data**
Nếu muốn giữ lại data từ local

---

## ✅ Option 1: Fresh Deploy

### **Bước 1: SSH vào Server**
```bash
ssh root@your_server_ip
```

### **Bước 2: Chuẩn Bị Thư Mục**
```bash
mkdir -p /opt/zalo-permission
cd /opt/zalo-permission
```

### **Bước 3: Clone/Upload Code**
```bash
# Nếu có Git
git clone https://github.com/your-username/zalo-permission.git .

# Hoặc upload zip
# scp zalo-permission.zip root@server:/opt/
# unzip zalo-permission.zip
```

### **Bước 4: Setup Environment**
```bash
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password
DATABASE_URL=postgres://plutusr:ccbbndctdkhmbddn@postgres:5432/plutusdb
EOF
```

### **Bước 5: Start Docker Services**
```bash
docker-compose up -d
```

### **Bước 6: Wait & Initialize Data**
```bash
# Chờ containers ready
sleep 15

# Initialize databases
bash backend/scripts/init-data.sh
```

### **Bước 7: Kiểm Tra**
```bash
# Check containers
docker-compose ps

# Health check
curl http://localhost:3000/api/health

# Logs
docker logs -f plutus-workspace-api
```

---

## 🔄 Option 2: Migrate Data từ Local

### **Bước 1: Backup từ Local**

```bash
# Terminal local của bạn

# Backup PostgreSQL
docker exec plutus-postgres pg_dump \
  -U plutusr plutusdb > ~/zalo_postgres_backup.sql

# Backup Neo4j (nếu có data quan trọng)
docker exec plutus-neo4j neo4j-admin database export \
  --database=neo4j /tmp/neo4j_backup.dump

# Copy từ container ra
docker cp plutus-neo4j:/tmp/neo4j_backup.dump ~/
```

### **Bước 2: Đẩy Backups lên Server**

```bash
scp ~/zalo_postgres_backup.sql root@server:/tmp/
scp ~/neo4j_backup.dump root@server:/tmp/
```

### **Bước 3: Deploy Code**

```bash
# Server
ssh root@server
cd /opt/zalo-permission
git clone <repo> .
docker-compose up -d
sleep 15
```

### **Bước 4: Restore Data**

```bash
# PostgreSQL
docker exec -i plutus-postgres psql \
  -U plutusr -d plutusdb < /tmp/zalo_postgres_backup.sql

# Neo4j
docker cp /tmp/neo4j_backup.dump plutus-neo4j:/tmp/
docker exec plutus-neo4j neo4j-admin database import \
  --database=neo4j --overwrite /tmp/neo4j_backup.dump

# Restart containers
docker-compose restart
```

### **Bước 5: Kiểm Tra**

```bash
curl http://localhost:3000/api/health
```

---

## 📊 Volumes Explanation

```yaml
# docker-compose.yml
volumes:
  plutus_data:   # PostgreSQL persists here
  neo4j_data:    # Neo4j persists here
```

**On Server:**
```
/var/lib/docker/volumes/
├── zalo-permission_plutus_data/
│   └── _data/           # PostgreSQL files
└── zalo-permission_neo4j_data/
    └── _data/           # Neo4j files
```

**Data tự động lưu** khi database chạy. Không cần move manually.

---

## 🔐 Setup Nginx Reverse Proxy

```bash
# Install Nginx
dnf install -y nginx

# Create config
cat > /etc/nginx/conf.d/zalo-api.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Test & start
nginx -t
systemctl start nginx
systemctl enable nginx
```

---

## 🔐 SSL/HTTPS Setup

```bash
dnf install -y certbot python3-certbot-nginx

certbot --nginx -d your-domain.com
```

---

## 📋 Checklist

- [ ] SSH vào server thành công
- [ ] Clone/upload code
- [ ] docker-compose up -d
- [ ] curl /api/health → OK
- [ ] Check docker logs
- [ ] Setup Nginx (nếu cần)
- [ ] Setup SSL (nếu production)

---

## 🆘 Troubleshooting

| Lỗi | Giải Pháp |
|-----|----------|
| `docker: command not found` | `dnf install -y docker docker-compose` |
| API không response | `docker logs plutus-workspace-api` |
| Database connection error | Check `DATABASE_URL` in `.env` |
| Port 3000 bị chiếm | `netstat -tlnp \| grep 3000` |

---

## 🎯 Kết Quả

- ✅ API chạy trên port 3000
- ✅ PostgreSQL chạy trên port 5432
- ✅ Neo4j chạy trên port 7687
- ✅ Data persisted trong volumes
- ✅ Ready cho production

---

## 📞 Quick Commands

```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop all
docker-compose down

# Remove volumes (⚠️ DATA LOSS)
docker-compose down -v

# Exec commands
docker exec plutus-postgres psql -U plutusr plutusdb
docker exec plutus-neo4j cypher-shell -u neo4j -p password
```

---

**Done! 🎉**
