# Portracker 本地部署指南

Portracker 是一个端口监控和管理工具，支持 Docker 容器发现、系统端口检测等功能。本指南介绍如何从源码构建并本地部署。

## 前置要求

- Docker Desktop (macOS/Windows) 或 Docker Engine (Linux)
- Docker Compose
- Git

## 克隆项目

```bash
git clone https://github.com/littleCareless/portracker.git
cd portracker
```

## 构建 Docker 镜像

### 选项 1：使用 Docker Compose 构建（推荐）

```bash
docker-compose up -d --build --no-cache
```

### 选项 2：手动构建

```bash
docker build -t portracker:latest .
```

## 配置说明

### 目录挂载

项目默认配置了以下数据目录：
- `./portracker-data:/data` - SQLite 数据库存储

### 必需权限

容器需要以下权限才能正常检测系统端口：
- `pid: "host"` - 访问主机进程信息
- `cap_add: SYS_PTRACE` - 读取 /proc 进程条目
- `cap_add: SYS_ADMIN` - Docker Desktop 命名空间访问
- `security_opt: apparmor:unconfined` - 禁用 AppArmor 限制

## 环境变量（可选）

如需自定义配置，可以在 `docker-compose.yml` 中取消注释相关环境变量：

```yaml
# 认证配置
# - ENABLE_AUTH=true
# - SESSION_SECRET=your-secret

# 反向代理支持
# - HOST_OVERRIDE=your-server-hostname

# 性能设置
# - CACHE_TIMEOUT_MS=60000
# - DISABLE_CACHE=true
# - INCLUDE_UDP=true

# 调试模式
# - DEBUG=true

# TrueNAS 集成
# - TRUENAS_API_KEY=your-api-key
```

## 常用命令

### 查看日志

```bash
# 实时日志
docker-compose logs -f

# 最近 100 行
docker-compose logs --tail 100
```

### 停止服务

```bash
docker-compose down
```

### 重启服务

```bash
docker-compose restart
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose down
docker-compose up -d --build --no-cache
```

## 访问应用

部署成功后，通过浏览器访问：

```
http://localhost:4999
```

## 故障排除

### 端口检测不完整

确保容器有足够的权限：
```bash
# 检查容器运行状态
docker ps | grep portracker

# 查看容器权限
docker inspect portracker | grep -A 10 CapAdd
```

### 数据库初始化失败

检查数据目录权限：
```bash
chmod 777 ./portracker-data
```

### 构建失败

清理 Docker 缓存后重试：
```bash
docker system prune -a
docker-compose build --no-cache
```
