"""
Export MobileNet V2 from torchvision as a TorchScript Mobile (.pt) file.
Usage: python3 scripts/export_mobilenet_pt.py
Output: test-models/mobilenet_v2.pt
"""

import torch
import torchvision.models as models
from pathlib import Path

out = Path(__file__).parent.parent / "test-models" / "mobilenet_v2.pt"

model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
model.train(False)

scripted = torch.jit.script(model)
scripted._save_for_lite_interpreter(str(out))

size_mb = out.stat().st_size / 1024 / 1024
print(f"Saved {out}  ({size_mb:.1f} MB)")
