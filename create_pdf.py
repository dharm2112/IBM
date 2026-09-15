import os
from reportlab.pdfgen import canvas

def create_pdf(filename):
    c = canvas.Canvas(filename)
    c.drawString(100, 750, "CLINICAL TRIAL PROTOCOL - AI EXTRACTION FIXTURE")
    c.drawString(100, 700, "1. Dosing Constraints")
    c.drawString(120, 680, "Patients must take 10mg orally once daily.")
    c.drawString(100, 640, "2. Lab Testing Requirements")
    c.drawString(120, 620, "Hemoglobin (HGB) must be greater than 10.0 g/dL prior to randomization.")
    c.save()

if __name__ == "__main__":
    os.makedirs("d:/hackthon/IBM/src/tests/fixtures", exist_ok=True)
    create_pdf("d:/hackthon/IBM/src/tests/fixtures/synthetic_protocol.pdf")
    print("Fixture created successfully.")
