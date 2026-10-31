import random
from typing import Optional

class SensorNoiseModel:
    """It will simulate the noise and hardware-level of failures"""

    def __init__(self, std_dev: float= 0.3, hardware_drop_rate: float= 0.015):
        self.std_dev = std_dev
        self.hardware_drop_rate = hardware_drop_rate

    def add_noise_and_drop(self, value: float) -> Optional[float]:
        if random.random() < self.hardware_drop_rate:
            return None
        return round(random.gauss(value, self.std_dev),2)