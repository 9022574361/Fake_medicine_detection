from PIL import Image
import random
import os

def predict_medicine(image_path):
    """
    Simulate medicine prediction.
    
    Parameters:
        image_path (str): Path to the medicine image.
        
    Returns:
        str: "Real Medicine" or "Fake Medicine" (dummy prediction)
             or a friendly error message for invalid input.
    
    Note:
        Replace this dummy logic with a trained ML model for accurate predictions.
    """
    # Check if the file exists
    if not os.path.exists(image_path):
        return "⚠ Image not found. Please scan again."
    
    try:
        # Open the image
        img = Image.open(image_path)
        img.verify()  # Verify that it's a valid image
        
        # Optional: check image size, if too small likely bad scan
        if img.size[0] < 50 or img.size[1] < 50:
            return "⚠ Image too small or unclear. Please scan again."
        
        # Dummy logic for medicine detection:
        # Currently random, replace with real ML detection later
        # For now, 10% chance it's "not a medicine"
        is_medicine = random.choices([True, False], weights=[0.9, 0.1])[0]
        if not is_medicine:
            return "⚠ Invalid input — please scan a medicine."
        
        # Dummy prediction logic
        result = random.choices(["Real Medicine", "Fake Medicine"], weights=[0.7, 0.3])[0]
        return result
    
    except Exception:
        return "⚠ Unable to read image. Please scan again."


# Test block
if __name__ == "__main__":
    test_image = "test.jpg"  # Replace with your image path
    print(predict_medicine(test_image))