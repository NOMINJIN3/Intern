import React, { useState, useRef } from 'react'; 

import FruitList from './FruitList';  

import { v4 as uuidv4 } from 'uuid';  

function App() { 

   const [fruits, setFruits] = useState([]) 
   const fruitNameRef = useRef() 

   function toggleFruit(id) { 

     const newfruits = [...fruits] 

     const fruit = newfruits.find(fruit => fruit.id === id) 

     fruit.complete = !fruit.complete 

     setFruits(newfruits)  

  } 

 function handleAddFruits(e) { 

     const name = fruitNameRef.current.value 

     if (name === '') return 

     setFruits(prevFruits => { 

       return [...prevFruits, { id: uuidv4(), name: name, complete: false }]  

    }) 

     fruitNameRef.current.value = null  

  } 

   function handleClearFruits() { 

     const newFruits = fruits.filter(fruit => !fruit.complete) 

     setFruits(newFruits)  

  } 

return (  
    <>  
      <FruitList fruits={fruits} toggleFruit={toggleFruit} />  

      <input ref={fruitNameRef} type="text" />  

      <button onClick={handleAddFruits}> Жагсаалт нэмэх</button>  

      <button onClick={handleClearFruits}>Арилгах</button> 
      
      <div>{fruits.filter(fruit => !fruit.complete).length} -ийг нэмсэн</div>  

    </>  
  ) 
 } 
 export default App; 
