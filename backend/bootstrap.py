#!/usr/bin/env python3
"""
VELTRIX Backend Bootstrap Script
Initializes the development environment and verifies system health.
"""

import sys
import subprocess
from pathlib import Path

def run_command(cmd, description):
    """Run a shell command and report results."""
    print(f"\n✓ {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print(f"  ✅ Success")
            return True
        else:
            print(f"  ❌ Failed: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print(f"  ⏱️  Timeout")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    print("""
    ╔════════════════════════════════════════════════════════╗
    ║         VELTRIX BACKEND - DEVELOPMENT SETUP            ║
    ║  Institutional AI Trading Platform                     ║
    ╚════════════════════════════════════════════════════════╝
    """)
    
    backend_path = Path(__file__).parent
    print(f"\n📁 Backend directory: {backend_path}")
    
    # Check Python version
    print(f"\n🐍 Python version: {sys.version.split()[0]}")
    if not (sys.version_info.major == 3 and sys.version_info.minor >= 11):
        print("  ⚠️  Warning: Python 3.11+ recommended")
    
    checks = [
        (f"cd {backend_path} && python -m pip list | grep fastapi", "Check FastAPI installation"),
        (f"cd {backend_path} && python -c 'import sqlalchemy; print(sqlalchemy.__version__)'", "Check SQLAlchemy installation"),
        (f"cd {backend_path} && python -c 'from app.core.config import settings; print(f\"✓ Config loaded: env={settings.env}\")'", "Test configuration loading"),
        (f"cd {backend_path} && python -c 'from app.db.models import Base; print(f\"✓ Models loaded: {len(Base.registry.mappers)} models\")'", "Test ORM models"),
    ]
    
    passed = 0
    for cmd, desc in checks:
        if run_command(cmd, desc):
            passed += 1
    
    print(f"\n\n📊 Status: {passed}/{len(checks)} checks passed")
    
    if passed == len(checks):
        print("""
    ✅ Environment ready! Start the backend with:
    
        cd backend
        python -m uvicorn app.main:app --reload --port 8000
    
    📚 API Documentation: http://localhost:8000/docs
    
    🔐 Default Test Credentials:
       Admin:  admin@veltrix.ai / Admin123!
       Demo:   demo@veltrix.ai / Demo123!
        """)
        return 0
    else:
        print("\n❌ Some checks failed. Please fix the errors above and try again.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
