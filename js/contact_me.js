function submitForm(event) {
    event.preventDefault();
  
    // Get the form data
    const form = document.getElementById("contact-form");
    const formData = new FormData(form);
  
    // Send a POST request to the Formspree endpoint
    fetch("https://formspree.io/mrgvavyn", {
      method: "POST",
      body: formData,
      headers: {
        "Accept": "application/json"
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then(data => {
      // Update the page with the success message
      const successMessage = document.getElementById("success-message");
      successMessage.innerHTML = "Thanks for your message! We'll be in touch soon.";
      
      // Reset the form
      form.reset();
    })
    .catch(error => {
      console.error("Error submitting form", error);
    });
  }
  