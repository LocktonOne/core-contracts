pragma solidity 0.8.17;

contract SimpleStorage {
  uint public storedData = 47;
  event stored(address _to, uint _amount);

  function set(uint x) public {
    emit stored(msg.sender, x);
    storedData = x;
  }

  function get() view public returns (uint retVal) {
    return storedData;
  }
}