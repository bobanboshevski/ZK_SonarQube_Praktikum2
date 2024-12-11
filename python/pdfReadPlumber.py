import pdfplumber
import pandas as pd
import json
import numpy as np
import re
import sys


def remove_word_plane(table_data):
    """Remove only the word 'Plane' from each cell, leaving other text unchanged"""
    for i in range(len(table_data)):
        for j in range(len(table_data[i])):
            if isinstance(table_data[i][j], str):
                table_data[i][j] = re.sub(r'\bPlane\b', '', table_data[i][j]).strip()
    return table_data


def clean_cell(cell):
    """Remove the values inside parentheses from a cell"""
    if cell is None:
        return cell
    return re.sub(r'\(.*?\)', '', cell).strip()

def remove_signs(cell):
    """Remove % and mm strings from the cell"""
    if cell is None:
        return cell
    cell = re.sub(r'%', '', cell)
    cell = re.sub(r'°', '', cell)
    cell = re.sub(r'\bmm\b', '', cell)
    return cell.strip()

def separate_planes_in_cell(table_data):
    """Separate 'Plane', 'Transverse Plane', and 'Frontal Plane' values into adjacent empty cells"""
    for i in range(len(table_data)):
        for j in range(len(table_data[i])):
            cell = table_data[i][j]
            if isinstance(cell, str):
                if "Plane" in cell:
                    planes = cell.split("Plane")
                    # Remove empty strings from the split result
                    planes = [plane.strip() for plane in planes if plane.strip()]
                    # Insert the planes into adjacent cells
                    table_data[i][j] = planes[0]
                    for k in range(1, len(planes)):
                        # Insert each plane into the next empty cell
                        if j + k < len(table_data[i]) and not table_data[i][j + k]:
                            table_data[i][j + k] = planes[k]
                elif "plane" in cell:
                    planes = cell.split("plane")
                    # Remove empty strings from the split result
                    planes = [plane.strip() for plane in planes if plane.strip()]
                    # Insert the planes into adjacent cells
                    table_data[i][j] = planes[0]
                    for k in range(1, len(planes)):
                        # Insert each plane into the next empty cell
                        if j + k < len(table_data[i]) and not table_data[i][j + k]:
                            table_data[i][j + k] = planes[k]

def insert_test_direction_row(table_data):
    """Insert the 'Test Direction' row after a cell containing 'CV' is found"""
    for i in range(len(table_data)):
        for j in range(len(table_data[i])):
            if "CV" in str(table_data[i][j]):
                new_row = ["Test Direction", "", "", "Sagittal Plane", "Transverse Plane", "Frontal Plane"]
                table_data.insert(i + 1, new_row)
                return

def remove_cv_columns(table_data):
    """Remove columns containing 'CV'"""
    columns_to_delete = set()
    for i in range(len(table_data)):
        for j in range(len(table_data[i])):
            if "CV" in str(table_data[i][j]):
                columns_to_delete.add(j)

    for row in table_data:
        for col_index in sorted(columns_to_delete, reverse=True):
            if col_index < len(row):
                del row[col_index]

    return table_data

def extract_text_from_pdf(file_path, include_null_tables=False):
    tables = []
    text_data = []
    excluded_headers = ["SmoothnessofMovements", "Movement plots", "Movement Plots", "Repetition Results", "Primary movements", "PRIMARY MOVEMENTS", "Primary Movements"]
    graphical_results_variations = [
        "Graphical Results", "GRAPHICAL RESULTS", "Graphical results", "graphical results",
        "GraphicalResults", "GRAPHICALRESULTS", "Graphicalresults", "graphicalresults", "Graphic Results", "GRAPHIC RESULTS","Graphic results","graphic results"
    ]
    strings_to_delete = ["Average angle in degrees","Lateral Flexion Left", "Average Position in Degrees", "TestDirection", "Left lateral bending", "LateralBendingLeft" ,"LateralBendingRight"] #"TurningRight"

    # Extract text from the entire PDF to check for "Butterfly-method"
    full_text = ""

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            full_text += text
            text_data.append(f"Page {page.page_number} Text:\n{text}\n" + "-" * 80)

    if "Butterfly-method" in full_text or 'The Butterfly Test Report' in full_text:
        # Execute code for Butterfly-method PDFs

        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_tables = page.extract_tables()
                for table in page_tables:
                    df = pd.DataFrame(table[1:], columns=table[0])
                    df = df.replace({np.nan: None})
                    columns = df.columns.tolist()

                    # Check if the table should be excluded
                    if any(header in columns for header in excluded_headers):
                        continue

                    # Clean the column headers and table cells
                    columns = [clean_cell(col) for col in columns]
                    df.columns = columns
                    df = df.applymap(lambda cell: clean_cell(cell) if isinstance(cell, str) else cell)

                    # Remove rows containing specific strings
                    df = df[~df.apply(lambda row: row.astype(str).str.contains('|'.join(strings_to_delete)).any(), axis=1)]

                    # Check if the table has a header matching any of the variations
                    if any(header in columns for header in graphical_results_variations):
                        # Find the index of the matching header
                        header_index = next(
                            (columns.index(header) for header in graphical_results_variations if header in columns),
                            None)
                        if header_index is not None:
                            df = df.drop(index=range(header_index,
                                                     header_index + 3))  # Delete the first three rows after the header
                            df = df.iloc[:-2]  # Delete the last two rows of the entire table

                    # Find the indices of all cells containing the string "2SD"
                    sd_indices = [(i, j) for i in range(len(df)) for j in range(len(df.columns)) if
                                  df.iloc[i, j] == '2SD']

                    # Delete cells directly below each "2SD" cell
                    for i, j in sd_indices:
                        for k in range(i, len(df)):
                            df.iloc[k, j] = None

                    # Delete rows with None values in '2SD' columns
                    for i, j in sd_indices:
                        for k in range(i, len(df)):
                            df.iloc[k, j] = None

                    # Drop rows and columns where all values are None
                    df.dropna(axis=0, how='all', inplace=True)
                    df.dropna(axis=1, how='all', inplace=True)

                    # Convert DataFrame to a list of lists
                    table_data = [df.columns.tolist()]
                    table_data.extend(df.values.tolist())

                    # Replace values in cells containing "Client performance" or "Average distance" with "-"
                    for i in range(len(table_data)):
                        for j in range(len(table_data[i])):

                            if "Patient performance" in str(table_data[i][j]) or "Average Amplitude Accuracy" in str(
                                    table_data[i][j]):
                                table_data[i][j] = "-"
                            if 'Client performance' in str(table_data[i][j]) or 'Average distance' in str(
                                    table_data[i][j]):
                                table_data[i][j] = "-"

                    # Replace cells containing only "-" with an empty string
                    for i in range(len(table_data)):
                        for j in range(len(table_data[i])):
                            if table_data[i][j] == "-":
                                table_data[i][j] = ""

                    # Move data after "%" sign to the next cell
                    for i in range(len(table_data)):
                        for j in range(len(table_data[i])):
                            if "%" in str(table_data[i][j]):
                                index = str(table_data[i][j]).index("%")
                                if index < len(str(table_data[i][j])) - 1:
                                    table_data[i][j + 1] = str(table_data[i][j])[index + 1:].strip()
                                    table_data[i][j] = str(table_data[i][j])[:index + 1].strip()

                    # Apply the remove_signs function to each cell
                    for i in range(len(table_data)):
                        for j in range(len(table_data[i])):
                            table_data[i][j] = remove_signs(table_data[i][j])

                    if include_null_tables:
                        # Include tables with more null values
                        final_table = [row for row in table_data if not all(cell == "" or cell is None for cell in row)]
                    else:
                        empty_or_none_cell = 0
                        value_in_cell = 0
                        for row in table_data:
                            for cell in row:
                                if cell == "" or cell is None:
                                    empty_or_none_cell += 1
                                else:
                                    value_in_cell += 1

                        if 2 * value_in_cell > empty_or_none_cell:
                            # Remove rows with all empty cells
                            final_table = [row for row in table_data if
                                           not all(cell == "" or cell is None for cell in row)]
                        else:
                            final_table = []

                    # Delete the last two rows if there are more than three rows
                    if len(final_table) > 3:
                        final_table = final_table[:-2]

                    if final_table:
                        separate_planes_in_cell(final_table)
                        insert_test_direction_row(final_table)
                        final_table = remove_cv_columns(final_table)
                        final_table = remove_word_plane(final_table)
                        tables.append(final_table)

    else:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_tables = page.extract_tables()
                for table in page_tables:
                    df = pd.DataFrame(table[1:], columns=table[0])
                    df = df.replace({np.nan: None})
                    columns = df.columns.tolist()

                    # Check if the table should be excluded
                    if any(header in columns for header in excluded_headers):
                        continue

                    # Clean the column headers and table cells
                    columns = [clean_cell(col) for col in columns]
                    df.columns = columns
                    df = df.applymap(lambda cell: clean_cell(cell) if isinstance(cell, str) else cell)

                    # Remove rows containing specific strings
                    df = df[~df.apply(lambda row: row.astype(str).str.contains('|'.join(strings_to_delete)).any(), axis=1)]

                    # Check if the table has a header matching any of the variations
                    if any(header in columns for header in graphical_results_variations):
                        # Find the index of the matching header
                        header_index = next(
                            (columns.index(header) for header in graphical_results_variations if header in columns),
                            None)
                        if header_index is not None:
                            df = df.drop(index=range(header_index,
                                                     header_index + 3))  # Delete the first three rows after the header
                            df = df.iloc[:-2]  # Delete the last two rows of the entire table

                    # Find the indices of all cells containing the string "2SD"
                    sd_indices = [(i, j) for i in range(len(df)) for j in range(len(df.columns)) if
                                  df.iloc[i, j] == '2SD']

                    # Delete cells directly below each "2SD" cell
                    for i, j in sd_indices:
                        for k in range(i, len(df)):
                            df.iloc[k, j] = None

                    # Delete rows with None values in '2SD' columns
                    for i, j in sd_indices:
                        for k in range(i, len(df)):
                            df.iloc[k, j] = None

                    # Drop rows and columns where all values are None
                    df.dropna(axis=0, how='all', inplace=True)
                    df.dropna(axis=1, how='all', inplace=True)

                    table_data = [df.columns.tolist()]
                    table_data.extend(df.values.tolist())

                    empty_or_none_cell = 0
                    value_in_cell = 0
                    for row in table_data:
                        for cell in row:
                            if cell == "" or cell is None:
                                empty_or_none_cell += 1
                            else:
                                value_in_cell += 1

                    if 2 * value_in_cell > empty_or_none_cell:
                        final_table = [row for row in table_data if not all(cell == "" or cell is None for cell in row)]
                        separate_planes_in_cell(final_table)  # Separate planes in the table
                        insert_test_direction_row(final_table)  # Insert the 'Test Direction' row if 'CV' is found
                        final_table = remove_cv_columns(final_table)  # Remove rows and cells containing 'CV'
                        final_table = remove_word_plane(final_table)                    
                        tables.append(final_table)

    return tables, text_data

if __name__ == "__main__":
    file_path = sys.argv[1]
    include_null_tables = True  # Set to True to include tables with more null values
    try:
        tables, text_data = extract_text_from_pdf(file_path, include_null_tables)
        print(json.dumps(tables))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
