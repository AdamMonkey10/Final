<command>// Update the handleScan function in pending.tsx to check systemCode instead of itemCode</command>
const handleScan = async (e: React.FormEvent) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const input = form.elements.namedItem('scanInput') as HTMLInputElement;
  const scannedCode = input.value.trim();
  form.reset();

  if (!selectedAction) return;

  try {
    if (scanDialog.step === 'item') {
      // Verify system-generated barcode instead of item code
      if (scannedCode !== selectedAction.systemCode) {
        toast.error('Invalid barcode scanned');
        return;
      }

      // Get available locations after item verification
      const availableLocations = await getAvailableLocations(selectedAction.weight);
      if (availableLocations.length > 0) {
        const optimal = findOptimalLocation(availableLocations, selectedAction.weight);
        if (optimal) {
          setSuggestedLocation(optimal);
          toast.success(`Please scan location: ${optimal.code}`);
          setScanDialog(prev => ({ ...prev, step: 'location' }));
        } else {
          toast.error('No optimal location found for this weight');
        }
      } else {
        toast.error('No suitable locations available');
      }
    } else {
      // Verify location barcode
      if (!suggestedLocation || scannedCode !== suggestedLocation.code) {
        toast.error('Invalid location code scanned');
        return;
      }

      // Update location with item
      await updateLocation(suggestedLocation.id, {
        currentWeight: suggestedLocation.currentWeight + selectedAction.weight,
      });

      // Update item with location and status
      await updateItem(selectedAction.itemId, {
        status: 'placed',
        location: suggestedLocation.code,
        locationVerified: true,
      });

      // Update action status
      await updateAction(selectedAction.id, {
        status: 'completed',
        location: suggestedLocation.code,
      });

      toast.success('Item placed successfully');
      setScanDialog({ open: false, step: 'item' });
      setSelectedAction(null);
      setSuggestedLocation(null);
    }
  } catch (error) {
    console.error('Error processing scan:', error);
    toast.error('Failed to process scan');
  }
};