import pandas as pd
import sys

try:
    file_path = r'c:\Users\kobpat_m\OneDrive - UNITED INFORMATION HIGHWAY CO.,LTD\Desktop\WebApp\ระบบขอคืนเงินประกัน\Report Update Work 2026.xlsx'
    # Check sheet names first
    xl = pd.ExcelFile(file_path)
    print(f"Sheets: {xl.sheet_names}")
    
    # Read the first sheet as priority
    df = pd.read_excel(file_path, sheet_name=0)
    print("Sample data from first sheet:")
    print(df.head(10).to_string())
    print("\nColumns:")
    print(df.columns.tolist())
except Exception as e:
    print(f"Error: {e}")
