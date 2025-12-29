# Facility Examples for Sign-In Flow & Provider Profile Creation

Three example facilities from the Arizona Licensed Facilities dataset showing different scenarios for designing sign-in and provider profile creation flows.

---

## Example 1: Child Care Center

**Facility Name:** Ethos Academy Little Owls Preschool & Pre K

**Identifiers:**

- License Number: `0020284CDCFI56724847`
- Facility ID: `0020284CDCFI56724847` (matches License Number)

**Contact Information:**

- Phone: `6232493211` (unformatted)
- Address: `8801 North 43rd Avenue`
- City: `Phoenix`
- County: `Maricopa`
- ZIP: `85051`

**Facility Details:**

- Type: `Child Care Center`
- Category: `CC` (Child Care)
- Bureau: `CC`
- Status: `Active`
- Capacity: `54`

**Notes for Design:**

- License Number and Facility ID are identical (common for Child Care)
- Phone number stored as `6232493211` (unformatted), but display/input should format as `(623) 249-3211` for better UX. Store normalized/unformatted version.
- Capacity field is populated (relevant for Child Care)

---

## Example 2: Child Care Group Home

**Facility Name:** La Casita de Kathy

**Identifiers:**

- License Number: `0020103CGHED66039102`
- Facility ID: `0020103CGHED66039102` (matches License Number)

**Contact Information:**

- Phone: `5203995885` (unformatted)
- Address: `2730 West Aurora Drive`
- City: `Tucson`
- County: `Pima`
- ZIP: `85746`

**Facility Details:**

- Type: `Child Care Group Home`
- Category: `CC` (Child Care)
- Bureau: `CC`
- Status: `Active`
- Capacity: `10`

**Notes for Design:**

- Different Child Care type (Group Home vs Center)
- Smaller capacity than Example 1
- Different location (Tucson vs Phoenix)
- Phone number stored as `5203995885` (unformatted), but display/input should format as `(520) 399-5885` for better UX. Store normalized/unformatted version.

---

## Example 3: Medical Facility

**Facility Name:** BANNER HOME CARE AZ

**Identifiers:**

- License Number: `HHA0015`
- Facility ID: `AZ037015` (different from License Number)

**Contact Information:**

- Phone: `(480)657-1000` (formatted with parentheses)
- Address: `525 W Brown Rd Ste 4002`
- City: `Mesa`
- County: `MARICOPA`
- ZIP: `85201`

**Facility Details:**

- Type: `HOME HEALTH AGENCY`
- Subtype: `HHA`
- Category: `MED` (Medical)
- Bureau: `MED`
- Status: `ACTIVE`
- Medicare ID: `037015`
- Capacity: (not provided)

**Notes for Design:**

- License Number and Facility ID are different formats (common for Medical)
- Has Medicare ID field (required for Medical, not applicable for Child Care)
- Has Subtype field (`HHA`)
- Phone number stored as `(480)657-1000` (formatted), but normalize to `4806571000` for storage. Display/input should format as `(480) 657-1000` for better UX.
- Capacity is null (not applicable for Medical facilities)
- Address includes suite number

---

## Key Design Considerations

### Sign-In Flow

- **License Number vs Facility ID:** Child Care facilities often have matching values, but Medical facilities have different formats. Support both as identifiers.
- **Phone Number Formats:** Data comes in various formats (unformatted `6232493211` or formatted `(480)657-1000`). For UX, display and accept input in formatted format `(XXX) XXX-XXXX`, but normalize to digits-only for storage and matching.
- **Facility Name:** Use for verification/confirmation during sign-in.

### Provider Profile Creation Flow

- **Dynamic Fields:** Medical facilities require Medicare ID and Subtype fields that Child Care doesn't have. Child Care requires Capacity field that Medical doesn't have.
- **License Number Format:** Child Care uses long alphanumeric format (`0020284CDCFI56724847`), Medical uses shorter format with prefix (`HHA0015`). Validate format based on facility Category (CC vs MED).
- **Phone Number UX:** Display formatted phone numbers `(XXX) XXX-XXXX` in UI, accept formatted input, but store normalized (digits-only) version for consistency and matching.
- **Address Variations:** Some addresses include suite/unit numbers in various formats (`Ste 4002`, `SUITE D-10`). Display as-is, but consider normalization for search.
- **Case Sensitivity:** Some fields come in uppercase (e.g., `MARICOPA`, `ACTIVE`, `HOME HEALTH AGENCY`). Normalize for consistent display (title case or sentence case).
- **Null/Empty Fields:** Many fields may be null (Capacity for Medical, Medicare ID for Child Care, License dates). Design forms to gracefully handle optional fields - hide irrelevant fields based on facility Category rather than showing empty/null values.
