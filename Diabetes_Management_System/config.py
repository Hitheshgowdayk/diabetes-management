import os


class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "change-this-secret-key-in-production")
    DATABASE_PATH = os.path.join(BASE_DIR, "database", "diabetes.db")

    DEFAULT_LOW_THRESHOLD = 70.0
    DEFAULT_FASTING_MIN = 70.0
    DEFAULT_FASTING_MAX = 99.0
    DEFAULT_POST_MEAL_MAX = 140.0
