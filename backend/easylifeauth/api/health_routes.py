"""Health Check Routes"""
import os
import sys
import time
import threading
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Query, Request

import psutil

router = APIRouter(tags=["Health"])

# Configuration
HEALTH_CHECK_CONFIG = {
    'database_enabled': True,
    'disk_usage_threshold': 90,
    'memory_usage_threshold': 90,
    'cpu_usage_threshold': 90,
}

# Global variables
_start_time = time.time()
_health_cache: Dict[str, Any] = {}
_cache_lock = threading.Lock()


def cache_health_data(ttl: int = 30):
    """Decorator to cache health check data"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            cache_key = func.__name__
            current_time = time.time()
            
            with _cache_lock:
                if cache_key in _health_cache:
                    cached_data, cache_time = _health_cache[cache_key]
                    if current_time - cache_time < ttl:
                        return cached_data
                
                result = func(*args, **kwargs)
                _health_cache[cache_key] = (result, current_time)
                return result
        return wrapper
    return decorator


@cache_health_data(ttl=30)
def get_system_metrics() -> Dict[str, Any]:
    """Get detailed system metrics"""
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        
        # Memory usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        # Disk usage
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        
        # Network I/O
        net_io = psutil.net_io_counters()
        
        # Process info
        process = psutil.Process()
        process_memory = process.memory_info()
        
        return {
            'cpu': {
                'usage_percent': cpu_percent,
                'count': cpu_count,
                'status': 'healthy' if cpu_percent < HEALTH_CHECK_CONFIG['cpu_usage_threshold'] else 'warning'
            },
            'memory': {
                'usage_percent': memory_percent,
                'total_gb': round(memory.total / (1024**3), 2),
                'available_gb': round(memory.available / (1024**3), 2),
                'status': 'healthy' if memory_percent < HEALTH_CHECK_CONFIG['memory_usage_threshold'] else 'warning'
            },
            'disk': {
                'usage_percent': round(disk_percent, 2),
                'total_gb': round(disk.total / (1024**3), 2),
                'free_gb': round(disk.free / (1024**3), 2),
                'status': 'healthy' if disk_percent < HEALTH_CHECK_CONFIG['disk_usage_threshold'] else 'warning'
            },
            'network': {
                'bytes_sent': net_io.bytes_sent,
                'bytes_received': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_received': net_io.packets_recv
            },
            'process': {
                'pid': os.getpid(),
                'memory_mb': round(process_memory.rss / (1024**2), 2),
                'threads': process.num_threads()
            }
        }
    except Exception as e:
        return {
            'error': f'Failed to collect system metrics: {str(e)}',
            'status': 'unhealthy'
        }


def determine_overall_status(checks: Dict[str, Any]) -> str:
    """Determine overall application health status"""
    statuses = []
    
    # Check system metrics
    if 'system' in checks:
        system = checks['system']
        if isinstance(system, dict):
            for component in ['cpu', 'memory', 'disk']:
                if component in system and 'status' in system[component]:
                    statuses.append(system[component]['status'])
    
    # Determine overall status
    if 'unhealthy' in statuses:
        return 'unhealthy'
    elif 'warning' in statuses or 'degraded' in statuses:
        return 'degraded'
    else:
        return 'healthy'


@router.get("/health")
async def health_check(
    request: Request,
    detailed: bool = Query(False, description="Include detailed information"),
    system: bool = Query(True, description="Include system metrics")
):
    """Comprehensive health check endpoint"""
    start_time = time.time()
    
    health_data = {
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'uptime_seconds': round(time.time() - _start_time, 2),
        'version': '1.0.0',
        'environment': os.getenv('ENVIRONMENT', 'production')
    }
    
    checks = {}
    
    # System metrics
    if system:
        checks['system'] = get_system_metrics()
    
    # Add detailed information if requested
    if detailed:
        health_data['checks'] = checks
        health_data['python_version'] = sys.version
        health_data['host'] = request.client.host if request.client else 'Unknown'
    
    # Determine overall status
    overall_status = determine_overall_status(checks)
    health_data['status'] = overall_status
    
    # Add response time
    health_data['response_time_ms'] = round((time.time() - start_time) * 1000, 2)
    
    return health_data


@router.get("/health/live")
async def liveness_check():
    """Simple liveness probe - checks if application is running"""
    return {
        'status': 'alive',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/ready")
async def readiness_check():
    """Readiness probe - checks if application is ready to serve traffic"""
    return {
        'status': 'ready',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/metrics")
async def metrics_endpoint():
    """Detailed metrics endpoint"""
    return {
        'system': get_system_metrics(),
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'uptime_seconds': round(time.time() - _start_time, 2)
    }


@router.get("/info")
async def app_info():
    """Application information endpoint"""
    return {
        'name': 'EasyLife Auth API',
        'version': '1.0.0',
        'description': 'Authentication and Authorization API',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
