def hybrid_prediction(ocr_text, model=None):
    """
    Simple hybrid prediction (temporary working version)
    """

    if not ocr_text:
        return {
            "verdict": "suspect",
            "confidence": 50
        }

    text = ocr_text.lower()

    if "fake" in text or "error" in text:
        return {
            "verdict": "fake",
            "confidence": 85
        }

    return {
        "verdict": "genuine",
        "confidence": 90
    }